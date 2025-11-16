import {useEffect, useState} from "react";


export default function useSystemTheme() {
    const [theme, setTheme] = useState('light');

    useEffect(() => {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
        setTheme(prefersDark.matches ? 'dark' : 'light');

        // Listen for changes
        const listener = (e: { matches: any; }) => setTheme(e.matches ? 'dark' : 'light');
        prefersDark.addEventListener('change', listener);

        return () => prefersDark.removeEventListener('change', listener);
    }, []);

    return theme;
}

