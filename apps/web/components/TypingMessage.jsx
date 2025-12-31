import { useState, useEffect } from 'react';

const TypingMessage = ({ text, typingSpeed = 20 }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    let index = 0;
    setDisplayedText(''); // Reset on text change

    if (!text) return;

    const intervalId = setInterval(() => {
      setDisplayedText((prev) => {
        if (index < text.length) {
          index++;
          return text.slice(0, index);
        } else {
          clearInterval(intervalId);
          return prev;
        }
      });
    }, typingSpeed);

    return () => clearInterval(intervalId);
  }, [text, typingSpeed]);

  return <span>{displayedText}</span>;
};

export default TypingMessage;
