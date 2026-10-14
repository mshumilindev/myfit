/** The top-bar avatar opens the SAME sheet as the tab bar's More (destinations, Apps, account): the bar owns the sheet. */
export const OPEN_MORE_EVENT = 'spotter:open-more';
export const requestOpenMore = (): void => {
  window.dispatchEvent(new Event(OPEN_MORE_EVENT));
};
