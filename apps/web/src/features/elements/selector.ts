/** True when the browser can parse `selector` as CSS. It does not check that it matches anything. */
export function isValidSelector(selector: string) {
  try {
    document.createDocumentFragment().querySelector(selector);
    return true;
  } catch {
    return false;
  }
}
