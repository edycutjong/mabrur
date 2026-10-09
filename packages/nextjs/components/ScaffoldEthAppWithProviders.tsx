"use client";

import { useEffect, useState } from "react";
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppProgressBar as ProgressBar } from "next-nprogress-bar";
import { useTheme } from "next-themes";
import { Toaster } from "react-hot-toast";
import { WagmiProvider } from "wagmi";
import { Footer } from "~~/components/Footer";
import { Header } from "~~/components/Header";
import { BlockieAvatar } from "~~/components/scaffold-eth";
import { wagmiConfig } from "~~/services/web3/wagmiConfig";

// RainbowKit modal in the v2 palette: old-green accent, cream text on it, white sheet, hairlines, Inter.
const BASE_THEME = lightTheme({ accentColor: "#0F3D30", accentColorForeground: "#F9F6F0", borderRadius: "large" });
const MABRUR_THEME = {
  ...BASE_THEME,
  colors: {
    ...BASE_THEME.colors,
    modalBackground: "#FFFFFF",
    modalBorder: "#E4E6EA",
    modalText: "#14181C",
    modalTextSecondary: "#5D646D",
    modalBackdrop: "rgba(20, 24, 28, 0.42)",
    actionButtonBorder: "#E4E6EA",
    actionButtonSecondaryBackground: "#F5F6F8",
    closeButton: "#5D646D",
    closeButtonBackground: "#F5F6F8",
    generalBorder: "#E4E6EA",
    menuItemBackground: "#E6ECE9",
    profileForeground: "#F9F6F0",
    selectedOptionBorder: "#0E8A5F",
    connectButtonBackground: "#FFFFFF",
    connectButtonText: "#0F3D30",
  },
  fonts: { body: 'var(--font-inter), "Inter", "Segoe UI", system-ui, sans-serif' },
  shadows: {
    ...BASE_THEME.shadows,
    dialog: "0 1px 2px rgba(15, 61, 48, .04), 0 24px 60px -28px rgba(15, 61, 48, .45)",
  },
};

const ScaffoldEthApp = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="relative flex flex-col flex-1">{children}</main>
        <Footer />
      </div>
      <Toaster
        toastOptions={{
          style: {
            fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
            fontSize: 14,
            color: "#14181C",
            background: "#FFFFFF",
            border: "1px solid #E4E6EA",
            borderRadius: 10,
            boxShadow: "0 18px 40px -26px rgba(15, 61, 48, .35)",
          },
          success: { iconTheme: { primary: "#0B6E4F", secondary: "#FFFFFF" } },
          error: { iconTheme: { primary: "#9E2A2B", secondary: "#FFFFFF" } },
        }}
      />
    </>
  );
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

export const ScaffoldEthAppWithProviders = ({ children }: { children: React.ReactNode }) => {
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider avatar={BlockieAvatar} theme={mounted && isDarkMode ? darkTheme() : MABRUR_THEME}>
          <ProgressBar height="2px" color="#0E8A5F" />
          <ScaffoldEthApp>{children}</ScaffoldEthApp>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
