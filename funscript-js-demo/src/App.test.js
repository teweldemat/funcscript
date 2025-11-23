import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';

test('parses the default script successfully', () => {
  render(<App />);
  const parseButton = screen.getByRole('button', { name: /parse script/i });
  fireEvent.click(parseButton);
  expect(screen.getByText(/parse success/i)).toBeInTheDocument();
});
