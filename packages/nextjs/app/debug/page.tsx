import { DebugContracts } from "./_components/DebugContracts";
import type { NextPage } from "next";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({
  title: "Contracts (debug)",
  description: "Read and call the deployed Mabrur contracts (MabrurPBM, ClaimRegistry, TIDR) directly.",
});

const Debug: NextPage = () => {
  return (
    <div className="overflow-x-clip">
      <DebugContracts />
      <div className="text-center mt-8 bg-secondary text-secondary-content p-10">
        <h1 className="text-4xl my-0">Debug Contracts</h1>
        <p>
          You can debug & interact with your deployed contracts here.
          <br /> Check{" "}
          <code className="italic bg-base-300 text-base font-bold [word-spacing:-0.5rem] px-1">
            packages / nextjs / app / debug / page.tsx
          </code>{" "}
        </p>
      </div>
    </div>
  );
};

export default Debug;
