export function getSafeExternalUrl(value: string | undefined): string | null {
  const trimmedValue = value?.trim();
  if (!trimmedValue || trimmedValue.includes("?") || trimmedValue.includes("#")) {
    return null;
  }

  try {
    const url = new URL(trimmedValue);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}
