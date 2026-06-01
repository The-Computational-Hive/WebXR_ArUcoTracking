export class AnchorManager {
  constructor() {
    this.isSupported = false;
    this.anchor = null;
  }

  async initialize(session) {
    this.isSupported = Boolean(session && session.requestAnchor);
    return this.isSupported;
  }

  async createAnchorAtPose() {
    // Anchor creation is wired in a later milestone.
    return null;
  }

  updateFromAnchor() {
    // Placeholder.
  }
}
