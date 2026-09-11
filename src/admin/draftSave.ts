/** Keeps edits made during a save and allows only one request at a time. */
export class DraftSaveController {
  private revision = 0;
  private activeRequest: symbol | null = null;

  get isSaving() {
    return this.activeRequest !== null;
  }

  markChanged() {
    this.revision += 1;
  }

  invalidate() {
    this.markChanged();
    this.activeRequest = null;
  }

  async save<T>(
    snapshot: T,
    persist: (snapshot: T) => Promise<T>,
    apply: (saved: T, hasNewerEdits: boolean) => void,
  ): Promise<boolean> {
    if (this.isSaving) return false;
    const request = Symbol('save');
    const revision = this.revision;
    this.activeRequest = request;
    try {
      const saved = await persist(snapshot);
      if (this.activeRequest !== request) return false;
      apply(saved, revision !== this.revision);
      return true;
    } catch (error) {
      if (this.activeRequest !== request) return false;
      throw error;
    } finally {
      if (this.activeRequest === request) this.activeRequest = null;
    }
  }
}
