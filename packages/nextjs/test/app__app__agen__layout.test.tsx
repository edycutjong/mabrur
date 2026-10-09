import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AgenLayout, { metadata } from "~~/app/app/agen/layout";

vi.mock("~~/utils/scaffold-eth/getMetadata", () => ({
  getMetadata: vi.fn((config: { title: string; description: string }) => ({
    title: {
      default: config.title,
      template: "%s | Mabrur",
    },
    description: config.description,
    metadataBase: new URL("http://localhost:3000"),
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
          url: "http://localhost:3000/og-image.png",
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
      images: ["http://localhost:3000/og-image.png"],
    },
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
        { url: "/icon.svg", type: "image/svg+xml" },
      ],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
  })),
}));

describe("AgenLayout", () => {
  it("exports metadata with correct title", () => {
    expect(metadata.title).toBeDefined();
    expect(metadata.title?.default).toBe("Konsol Agen");
  });

  it("exports metadata with correct description", () => {
    expect(metadata.description).toBe(
      "Konsol agen: bayar faktur vendor berlisensi dari satu booking, lihat setiap penolakan terdekode, dan baca panel regulator.",
    );
  });

  it("exports metadata with title template", () => {
    expect(metadata.title?.template).toBe("%s | Mabrur");
  });

  it("exports metadata with openGraph config", () => {
    expect(metadata.openGraph).toBeDefined();
    expect(metadata.openGraph?.title?.default).toBe("Konsol Agen");
    expect(metadata.openGraph?.description).toBe(
      "Konsol agen: bayar faktur vendor berlisensi dari satu booking, lihat setiap penolakan terdekode, dan baca panel regulator.",
    );
    expect(metadata.openGraph?.siteName).toBe("Mabrur");
    expect(metadata.openGraph?.type).toBe("website");
  });

  it("exports metadata with twitter config", () => {
    expect(metadata.twitter).toBeDefined();
    expect(metadata.twitter?.card).toBe("summary_large_image");
    expect(metadata.twitter?.title?.default).toBe("Konsol Agen");
    expect(metadata.twitter?.description).toBe(
      "Konsol agen: bayar faktur vendor berlisensi dari satu booking, lihat setiap penolakan terdekode, dan baca panel regulator.",
    );
  });

  it("renders children correctly", () => {
    const testContent = "Test Child Content";
    render(<AgenLayout>{testContent}</AgenLayout>);
    expect(screen.getByText(testContent)).toBeInTheDocument();
  });

  it("renders React node children", () => {
    render(
      <AgenLayout>
        <div data-testid="child-element">Child Element</div>
      </AgenLayout>,
    );
    expect(screen.getByTestId("child-element")).toBeInTheDocument();
    expect(screen.getByText("Child Element")).toBeInTheDocument();
  });

  it("renders multiple children", () => {
    render(
      <AgenLayout>
        <span>First</span>
        <span>Second</span>
        <span>Third</span>
      </AgenLayout>,
    );
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
    expect(screen.getByText("Third")).toBeInTheDocument();
  });

  it("renders fragment children", () => {
    render(
      <AgenLayout>
        <>
          <p>Paragraph 1</p>
          <p>Paragraph 2</p>
        </>
      </AgenLayout>,
    );
    expect(screen.getByText("Paragraph 1")).toBeInTheDocument();
    expect(screen.getByText("Paragraph 2")).toBeInTheDocument();
  });
});
