import React from 'react';
import { Input } from '@/components/ui/input';

export default function DebouncedInput({ 
    value, 
    onChange, 
    delay = 300, 
    ...props 
}) {
    const [inputValue, setInputValue] = React.useState(value);
    const timeoutRef = React.useRef();

    React.useEffect(() => {
        setInputValue(value);
    }, [value]);

    React.useEffect(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            if (inputValue !== value) {
                onChange(inputValue);
            }
        }, delay);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [inputValue, value, onChange, delay]);

    return (
        <Input
            {...props}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
        />
    );
}