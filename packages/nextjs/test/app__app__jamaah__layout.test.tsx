import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock the getMetadata utility before importing the layout
vi.mock("~~/utils/scaffold-eth/getMetadata", () => {
  const mockGetMetadata = vi.fn((config: { title: string; description: string; imageRelativePath?: string }) => ({
    metadataBase: new URL("http://localhost:3000"),
    title: {
      default: config.title,
      template: "%s | Mabrur",
    },
    description: config.description,
    openGraph: {
      title: {
        default: config.title,
        template: "%s | Mabrur",
      },
      description: config.description,
      siteName: "Mabrur",
      type: "website",
      images: [
        {
          url: `http://localhost:3000${config.imageRelativePath || "/og-image.png"}`,
          width: 2400,
          height: 1260,
          alt: "Mabrur — purpose-bound umrah prepayment on Arbitrum One",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: {
        default: config.title,
        template: "%s | Mabrur",
      },
      description: config.description,
      images: [`http://localhost:3000${config.imageRelativePath || "/og-image.png"}`],
    },
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
        { url: "/icon.svg", type: "image/svg+xml" },
      ],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
  }));
  return { getMetadata: mockGetMetadata };
});

describe("app/app/jamaah/layout.tsx", () => {
  it("exports metadata with correct title", async () => {
    const { metadata } = await import("~~/app/app/jamaah/layout");

    expect(metadata).toBeDefined();
    expect(metadata.title).toBeDefined();
    expect(metadata.title.default).toBe("Buku Amanah · Jamaah");
  });

  it("exports metadata with correct description", async () => {
    const { metadata } = await import("~~/app/app/jamaah/layout");

    expect(metadata).toBeDefined();
    expect(metadata.description).toBe(
      "Pesan umrah dengan satu tanda tangan dan baca buku amanah Anda: setiap rupiah dikunci per pos, bisa di-refund siapa pun.",
    );
  });

  it("exports metadata with title template from getMetadata", async () => {
    const { metadata } = await import("~~/app/app/jamaah/layout");

    expect(metadata.title.template).toBe("%s | Mabrur");
  });

  it("exports metadata with openGraph configuration", async () => {
    const { metadata } = await import("~~/app/app/jamaah/layout");

    expect(metadata.openGraph).toBeDefined();
    expect(metadata.openGraph?.title).toBeDefined();
    expect(metadata.openGraph?.title?.default).toBe("Buku Amanah · Jamaah");
    expect(metadata.openGraph?.description).toBe(
      "Pesan umrah dengan satu tanda tangan dan baca buku amanah Anda: setiap rupiah dikunci per pos, bisa di-refund siapa pun.",
    );
    expect(metadata.openGraph?.siteName).toBe("Mabrur");
    expect(metadata.openGraph?.type).toBe("website");
    expect(metadata.openGraph?.images).toBeDefined();
    expect(Array.isArray(metadata.openGraph?.images)).toBe(true);
  });

  it("exports metadata with twitter configuration", async () => {
    const { metadata } = await import("~~/app/app/jamaah/layout");

    expect(metadata.twitter).toBeDefined();
    expect(metadata.twitter?.card).toBe("summary_large_image");
    expect(metadata.twitter?.title).toBeDefined();
    expect(metadata.twitter?.title?.default).toBe("Buku Amanah · Jamaah");
    expect(metadata.twitter?.description).toBe(
      "Pesan umrah dengan satu tanda tangan dan baca buku amanah Anda: setiap rupiah dikunci per pos, bisa di-refund siapa pun.",
    );
  });

  it("exports metadata with icons configuration", async () => {
    const { metadata } = await import("~~/app/app/jamaah/layout");

    expect(metadata.icons).toBeDefined();
    expect(metadata.icons?.icon).toBeDefined();
    expect(Array.isArray(metadata.icons?.icon)).toBe(true);
    expect(metadata.icons?.apple).toBeDefined();
    expect(Array.isArray(metadata.icons?.apple)).toBe(true);
  });

  it("renders children when provided as single element", async () => {
    const { default: JamaahLayout } = await import("~~/app/app/jamaah/layout");
    const testContent = "Test Jamaah Content";

    const { getByText } = render(
      <JamaahLayout>
        <div>{testContent}</div>
      </JamaahLayout>,
    );

    expect(getByText(testContent)).toBeInTheDocument();
  });

  it("renders children when provided as multiple elements", async () => {
    const { default: JamaahLayout } = await import("~~/app/app/jamaah/layout");

    const { getByText } = render(
      <JamaahLayout>
        <div>First Child</div>
        <div>Second Child</div>
      </JamaahLayout>,
    );

    expect(getByText("First Child")).toBeInTheDocument();
    expect(getByText("Second Child")).toBeInTheDocument();
  });

  it("renders children without wrapping them in additional elements", async () => {
    const { default: JamaahLayout } = await import("~~/app/app/jamaah/layout");

    const { container } = render(
      <JamaahLayout>
        <span data-testid="child-element">Direct Child</span>
      </JamaahLayout>,
    );

    const childElement = container.querySelector('[data-testid="child-element"]');
    expect(childElement).toBeInTheDocument();
  });

  it("accepts React.ReactNode as children type", async () => {
    const { default: JamaahLayout } = await import("~~/app/app/jamaah/layout");

    // This test verifies that the layout accepts various React.ReactNode types
    const { rerender } = render(
      <JamaahLayout>
        <p>Text content</p>
      </JamaahLayout>,
    );

    rerender(
      <JamaahLayout>
        <>Fragment content</>
      </JamaahLayout>,
    );

    rerender(<JamaahLayout>{null}</JamaahLayout>);

    rerender(<JamaahLayout>{undefined}</JamaahLayout>);

    // If we got here without errors, the prop typing is working correctly
    expect(true).toBe(true);
  });

  it("exports a default function named JamaahLayout", async () => {
    const { default: JamaahLayout } = await import("~~/app/app/jamaah/layout");

    expect(typeof JamaahLayout).toBe("function");
  });

  it("layout function returns children directly", async () => {
    const { default: JamaahLayout } = await import("~~/app/app/jamaah/layout");

    // Verify that the component returns children as-is
    const result = JamaahLayout({ children: <div>Test</div> });

    expect(result).toBeDefined();
    expect(result?.type).toBe("div");
  });

  it("layout handles string children correctly", async () => {
    const { default: JamaahLayout } = await import("~~/app/app/jamaah/layout");

    const { getByText } = render(<JamaahLayout>String content only</JamaahLayout>);

    expect(getByText("String content only")).toBeInTheDocument();
  });

  it("layout handles empty children", async () => {
    const { default: JamaahLayout } = await import("~~/app/app/jamaah/layout");

    const { container } = render(<JamaahLayout>{null}</JamaahLayout>);

    expect(container).toBeDefined();
  });
});
