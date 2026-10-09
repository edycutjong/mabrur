import { describe, expect, it, vi } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

describe("app/page.tsx — Home component", () => {
  it("exports Home as default export", async () => {
    const pageModule = await import("~~/app/page");
    expect(pageModule.default).toBeDefined();
    expect(typeof pageModule.default).toBe("function");
  });

  it("Home function falls back to the static landing page", async () => {
    const { redirect } = await import("next/navigation");
    const mockRedirect = vi.mocked(redirect);

    // Clear any previous calls
    mockRedirect.mockClear();

    // Get the Home function
    const { default: Home } = await import("~~/app/page");

    // Call the Home function - redirect is mocked so it won't actually redirect
    Home();

    // Verify redirect was called with the correct path
    expect(mockRedirect).toHaveBeenCalledWith("/landing/index.html");
    expect(mockRedirect).toHaveBeenCalledTimes(1);
  });

  it("Home function is the only export", async () => {
    const pageModule = await import("~~/app/page");
    const exportKeys = Object.keys(pageModule);

    // Should only have 'default' key
    expect(exportKeys).toEqual(["default"]);
  });
});
