import React from 'react';
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useLanguage, Language } from './LanguageContext';
import { Globe } from 'lucide-react';

export function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage();

  const languages = [
    { code: 'en' as Language, name: 'English', flag: '🇺🇸' },
    { code: 'ru' as Language, name: 'Русский', flag: '🇷🇺' }
  ];

  const currentLanguage = languages.find(lang => lang.code === language);

  return (
    <Select value={language} onValueChange={(value: Language) => setLanguage(value)}>
      <SelectTrigger className="w-36">
        <div className="flex items-center space-x-2">
          <Globe className="h-4 w-4" />
          <span>{currentLanguage?.flag}</span>
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        {languages.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            <div className="flex items-center space-x-2">
              <span>{lang.flag}</span>
              <span>{lang.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}