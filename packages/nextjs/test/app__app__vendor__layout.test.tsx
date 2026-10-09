import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
// Import after mocking
import { default as VendorLayout, metadata } from "~~/app/app/vendor/layout";

// Mock getMetadata before importing the layout
vi.mock("~~/utils/scaffold-eth/getMetadata", () => ({
  getMetadata: vi.fn(config => ({
    title: config.title,
    description: config.description,
    openGraph: {
      title: config.title,
      description: config.description,
    },
  })),
}));

describe("VendorLayout", () => {
  it("exports metadata with correct title", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("Faktur Vendor");
  });

  it("exports metadata with correct description", () => {
    expect(metadata).toBeDefined();
    expect(metadata.description).toContain("A licensed vendor signs an invoice");
  });

  it("renders children correctly", () => {
    const testContent = "Test child content";
    const { getByText } = render(<VendorLayout>{testContent}</VendorLayout>);
    expect(getByText(testContent)).toBeInTheDocument();
  });

  it("renders react element children", () => {
    const { getByTestId } = render(
      <VendorLayout>
        <div data-testid="child-element">Child element</div>
      </VendorLayout>,
    );
    expect(getByTestId("child-element")).toBeInTheDocument();
  });

  it("renders multiple children correctly", () => {
    const { getByText } = render(
      <VendorLayout>
        <div>First child</div>
        <div>Second child</div>
      </VendorLayout>,
    );
    expect(getByText("First child")).toBeInTheDocument();
    expect(getByText("Second child")).toBeInTheDocument();
  });

  it("returns children as ReactNode", () => {
    const testChild = <span>Test</span>;
    const { container } = render(<VendorLayout>{testChild}</VendorLayout>);
    expect(container.querySelector("span")).toBeInTheDocument();
  });
});
