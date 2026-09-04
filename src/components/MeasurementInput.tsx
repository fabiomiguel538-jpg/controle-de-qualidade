import React, { useState, useEffect, useRef } from 'react';

interface MeasurementInputProps {
  value: number | undefined;
  onChange: (val: number) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
}

export const MeasurementInput: React.FC<MeasurementInputProps> = ({
  value,
  onChange,
  disabled,
  placeholder = "0.0",
  className,
  id
}) => {
  const isFocusedRef = useRef(false);
  const [text, setText] = useState<string>(() => {
    if (value !== undefined && value !== null && value !== 0) {
      return String(value);
    }
    return '';
  });

  // Sincroniza com valor externo quando o campo não está com foco ativo
  useEffect(() => {
    if (!isFocusedRef.current) {
      if (value !== undefined && value !== null && value !== 0) {
        setText(String(value));
      } else {
        setText('');
      }
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    
    // Aceita números, vírgula, ponto e hífen
    const sanitized = raw.replace(/[^0-9.,-]/g, '');
    setText(sanitized);

    const trimmed = sanitized.trim();
    if (trimmed === '' || trimmed === '-' || trimmed === '.' || trimmed === ',') {
      onChange(0);
      return;
    }

    const normalized = trimmed.replace(',', '.');
    const parsed = parseFloat(normalized);
    if (!isNaN(parsed)) {
      onChange(parsed);
    } else {
      onChange(0);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocusedRef.current = true;
    // Seleciona o texto ao focar se for conveniente para o operador
    if (value !== undefined && value !== null && value !== 0) {
      setText(String(value));
    }
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    const trimmed = text.trim();
    
    if (trimmed === '' || trimmed === '.' || trimmed === ',' || trimmed === '-') {
      setText('');
      onChange(0);
    } else {
      const normalized = trimmed.replace(',', '.');
      const parsed = parseFloat(normalized);
      if (!isNaN(parsed)) {
        if (parsed === 0) {
          // Se o operador digitou '0' explicitamente, mantém '0'
          setText('0');
        } else {
          setText(String(parsed));
        }
        onChange(parsed);
      } else {
        setText('');
        onChange(0);
      }
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      id={id}
      value={text}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      disabled={disabled}
      placeholder={placeholder}
      className={className}
      autoComplete="off"
    />
  );
};

export default MeasurementInput;
