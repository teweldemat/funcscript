import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders the FuncScript editor demo", () => {
  render(<App />);
  expect(
    screen.getByText(/FuncScriptEditor CommonJS compatibility/i)
  ).toBeInTheDocument();
});
