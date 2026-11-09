import { useState } from "react";
import { setTheme } from "../theme";
import { ColourPicker, SampleCode } from "./ThemePicker";

/** Two steps: what this is, and your colours (the one thing that's yours to choose; the rest is the house style). */
export function Onboarding() {
  const [step, setStep] = useState(0);
  const next = () => (step < 1 ? setStep(step + 1) : setTheme({ onboarded: true }));
  return (
    <div className="onboarding">
      <div className="ob-top">
        <span>QR Code Pocket</span>
        <span className="kicker">{step + 1} / 2</span>
      </div>
      <div className="scroll ob-body" key={step}>
          {step === 0 ? (
            <>
              <h1 className="serif-xl">Every code, one wallet.</h1>
              <p className="lede">Train tickets, museum entries, lunch bookings, takeaway orders. Add the screenshot or PDF; the code is read on your phone and printed in your style. When it's used it gets postmarked and stays with you.</p>
            </>
          ) : (
            <>
              <h1 className="serif-xl">Two colours.</h1>
              <p className="lede">Everything is printed in one ink and one paper. Day or night paper; your colour as lines, or flooding the page.</p>
              <ColourPicker />
            </>
          )}
          <SampleCode />
      </div>
      <div className="ob-foot">
        {step > 0 ? <button className="btn line" onClick={() => setStep(step - 1)}>Back</button> : <span />}
        <button className="btn solid" onClick={next}>{step === 1 ? "Start" : "Next"}</button>
      </div>
    </div>
  );
}
