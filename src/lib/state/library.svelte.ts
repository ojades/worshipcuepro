class LibraryState {
  selectedTab = $state("cue");

  setSelectedTab(tab: string) {
    this.selectedTab = tab;
  }
}
export const libraryState = new LibraryState();
