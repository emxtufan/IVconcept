export interface UploadedMediaAsset {
  url: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  width: number | null;
  height: number | null;
}

export interface UploadMediaResponse {
  files: UploadedMediaAsset[];
}

interface PreparedUploadFile {
  file: File;
  originalName: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
}

interface PresignedUploadResponse {
  files: Array<{
    uploadUrl: string;
    headers?: Record<string, string>;
    asset: UploadedMediaAsset;
  }>;
}

function isRasterImage(mimeType: string) {
  return mimeType.startsWith('image/') && !/image\/(gif|svg\+xml)/i.test(mimeType);
}

function fileNameStem(value: string) {
  return value.replace(/\.[^/.]+$/, '');
}

function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Could not read image metadata for ${file.name}.`));
    };

    image.src = objectUrl;
  });
}

async function optimizeRasterImage(file: File): Promise<PreparedUploadFile> {
  const image = await loadImageFromFile(file);
  const naturalWidth = image.naturalWidth || image.width;
  const naturalHeight = image.naturalHeight || image.height;

  if (!naturalWidth || !naturalHeight) {
    return {
      file,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      width: null,
      height: null,
    };
  }

  const scale = Math.min(1, 1800 / Math.max(naturalWidth, naturalHeight));
  const width = Math.max(1, Math.round(naturalWidth * scale));
  const height = Math.max(1, Math.round(naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');

  if (!context) {
    return {
      file,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      width: naturalWidth,
      height: naturalHeight,
    };
  }

  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/webp', 0.82);
  });

  if (!blob) {
    return {
      file,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      width: naturalWidth,
      height: naturalHeight,
    };
  }

  const optimizedFile = new File(
    [blob],
    `${fileNameStem(file.name) || 'image'}.webp`,
    { type: 'image/webp' },
  );

  return {
    file: optimizedFile,
    originalName: file.name,
    mimeType: 'image/webp',
    size: optimizedFile.size,
    width,
    height,
  };
}

async function prepareUploadFile(file: File): Promise<PreparedUploadFile> {
  if (typeof window === 'undefined') {
    return {
      file,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      width: null,
      height: null,
    };
  }

  if (isRasterImage(file.type)) {
    return optimizeRasterImage(file);
  }

  if (file.type.startsWith('image/')) {
    try {
      const image = await loadImageFromFile(file);
      return {
        file,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        width: image.naturalWidth || image.width || null,
        height: image.naturalHeight || image.height || null,
      };
    } catch {
      return {
        file,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        width: null,
        height: null,
      };
    }
  }

  return {
    file,
    originalName: file.name,
    mimeType: file.type,
    size: file.size,
    width: null,
    height: null,
  };
}

function uploadFileToSignedUrl(
  url: string,
  file: File,
  headers: Record<string, string> | undefined,
  onProgress: (progressRatio: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);

    Object.entries(headers ?? {}).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }

      onProgress(event.loaded / event.total);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }

      reject(new Error(`Direct upload failed with status ${xhr.status}.`));
    };

    xhr.onerror = () => {
      reject(new Error('Network error while uploading directly to Cloudflare R2.'));
    };

    xhr.send(file);
  });
}

function resolvePresignEndpoint(finalizeEndpoint: string) {
  if (/^\/api\/galleries\/\d+\/upload$/.test(finalizeEndpoint)) {
    return `${finalizeEndpoint}/presign`;
  }

  return '/api/uploads/presign';
}

export async function uploadFilesWithProgress(
  files: File[],
  onProgress: (progress: number) => void,
  finalizeEndpoint = '/api/uploads/media',
) {
  const preparedFiles = await Promise.all(files.map((file) => prepareUploadFile(file)));

  const presignResponse = await fetch(resolvePresignEndpoint(finalizeEndpoint), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      files: preparedFiles.map((file) => ({
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
      })),
    }),
  });

  if (!presignResponse.ok) {
    const payload = (await presignResponse.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message ?? `Failed to prepare upload: ${presignResponse.status}`);
  }

  const { files: signedFiles } = (await presignResponse.json()) as PresignedUploadResponse;

  if (signedFiles.length !== preparedFiles.length) {
    throw new Error('Upload preparation did not return all signed files.');
  }

  const totalBytes = preparedFiles.reduce((sum, file) => sum + Math.max(file.size, 1), 0);
  let uploadedBytes = 0;

  const uploadedAssets: UploadedMediaAsset[] = [];

  for (const [index, preparedFile] of preparedFiles.entries()) {
    const signedFile = signedFiles[index];

    await uploadFileToSignedUrl(
      signedFile.uploadUrl,
      preparedFile.file,
      signedFile.headers,
      (progressRatio) => {
        const currentUploaded = uploadedBytes + (preparedFile.size * progressRatio);
        onProgress(Math.min(100, Math.round((currentUploaded / totalBytes) * 100)));
      },
    );

    uploadedBytes += preparedFile.size;

    uploadedAssets.push({
      ...signedFile.asset,
      originalName: preparedFile.originalName,
      size: preparedFile.size,
      mimeType: preparedFile.mimeType,
      width: preparedFile.width,
      height: preparedFile.height,
    });
  }

  onProgress(100);

  const finalizeResponse = await fetch(finalizeEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      files: uploadedAssets,
    }),
  });

  if (!finalizeResponse.ok) {
    const payload = (await finalizeResponse.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message ?? `Upload finalize failed with status ${finalizeResponse.status}`);
  }

  return (await finalizeResponse.json()) as UploadMediaResponse;
}
