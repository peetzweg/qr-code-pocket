import { useState } from "react";
import { setTheme, useTheme } from "../theme";
import { StyleTrack } from "./StylePager";
import { ColourPicker, SAMPLE, SampleCode } from "./ThemePicker";

/** Three steps: what this is, your two colours, your code style. All of it can be changed later. */
export function Onboarding() {
  const [step, setStep] = useState(0);
  const style = useTheme((t) => t.qrStyle);
  const next = () => (step < 2 ? setStep(step + 1) : setTheme({ onboarded: true }));
  return (
    <div className="onboarding">
      <div className="ob-top">
        <span>QR Code Pocket</span>
        <span className="kicker">{step + 1} / 3</span>
      </div>
      {step < 2 ? (
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
      ) : (
        <div className="ob-styles">
          <p className="lede ob-lede">Swipe through how your codes are printed. Same content; the plain code is always one tap away.</p>
          <StyleTrack code={SAMPLE.codes[0]} value={style} onChange={(s) => setTheme({ qrStyle: s })} />
        </div>
      )}
      <div className="ob-foot">
        {step > 0 ? <button className="btn line" onClick={() => setStep(step - 1)}>Back</button> : <span />}
        <button className="btn solid" onClick={next}>{step === 2 ? "Start" : "Next"}</button>
      </div>
    </div>
  );
}
