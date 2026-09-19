import Header from "@/components/Header";
import HeroRing from "@/components/HeroRing";
import Marquee from "@/components/Marquee";
import TokenCreator from "@/components/TokenCreator";
import { APP_NAME } from "@/lib/config";

export default function Home() {
  return (
    <>
      <Header />
      <div className="relative overflow-hidden">
        <HeroRing />
      <section className="relative mx-auto w-full max-w-6xl px-4 pb-10 pt-6 sm:px-6 sm:pt-10">
        <p className="eyebrow rise">Solana token foundry / no keys held / one signature</p>
        <h1
          className="rise font-display mt-4 max-w-4xl text-[clamp(3rem,9.2vw,7.4rem)] font-extrabold leading-[0.9] tracking-[-0.035em]"
          style={{ ["--d" as string]: "0.08s" }}
        >
          Strike your
          <br />
          own <span className="marker">coin</span>.
        </h1>
        <p className="rise mt-6 max-w-xl text-lg leading-relaxed text-inksoft" style={{ ["--d" as string]: "0.18s" }}>
          Name it, give it a face, set the supply and choose your seals. Sign once and it lands on Solana with the whole supply in your wallet.
        </p>
      </section>
      </div>

      <Marquee />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-12 sm:px-6">
        <TokenCreator />
      </main>

      <footer className="border-t-2 border-ink bg-paperhi">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-[0.78rem] leading-relaxed text-muted sm:px-6">
          <p>
            {APP_NAME} runs in your browser. Your wallet signs every transaction and this app never sees your private keys. You are responsible for the tokens you create and for
            following the laws where you live. Nothing here is financial advice.
          </p>
        </div>
      </footer>
    </>
  );
}
