import React, { useState, useEffect, useRef } from 'react';
import { Clock, Check, X } from 'lucide-react';
import clsx from 'clsx';
import { SHIFT_HOURS } from '../lib/constants';

interface TimeInputProps {
  id?: string;
  value: string;
  onChange: (time: string) => void;
  disabled?: boolean;
  className?: string;
  shift?: string;
  label?: string;
}

export default function TimeInput({
  id,
  value,
  onChange,
  disabled = false,
  className = '',
  shift,
  label
}: TimeInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localValue, setLocalValue] = useState(value || '');
  const [showModal, setShowModal] = useState(false);

  // Parse hour and minute for modal
  const [modalHour, setModalHour] = useState(() => {
    const parts = (value || '').split(':');
    return parts[0] || new Date().getHours().toString().padStart(2, '0');
  });
  const [modalMinute, setModalMinute] = useState(() => {
    const parts = (value || '').split(':');
    return parts[1] || '00';
  });

  // Keep localValue in sync with prop
  useEffect(() => {
    if (value) {
      const clean = value.slice(0, 5);
      setLocalValue(clean);
      if (inputRef.current && inputRef.current.value !== clean) {
        inputRef.current.value = clean;
      }
      const parts = clean.split(':');
      if (parts[0]) setModalHour(parts[0]);
      if (parts[1]) setModalMinute(parts[1]);
    }
  }, [value]);

  // Direct native DOM event listeners to solve the Android Chrome React 19 bug
  // where tapping "DEFINIR" on the native time picker does not trigger synthetic onChange
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    const handleNativeEvent = () => {
      const currentVal = el.value;
      if (currentVal) {
        const clean = currentVal.slice(0, 5);
        setLocalValue(clean);
        onChange(clean);
      }
    };

    el.addEventListener('change', handleNativeEvent);
    el.addEventListener('input', handleNativeEvent);
    el.addEventListener('blur', handleNativeEvent);

    return () => {
      el.removeEventListener('change', handleNativeEvent);
      el.removeEventListener('input', handleNativeEvent);
      el.removeEventListener('blur', handleNativeEvent);
    };
  }, [onChange]);

  const handleManualChange = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    const val = target.value;
    if (val) {
      const clean = val.slice(0, 5);
      setLocalValue(clean);
      onChange(clean);
    }
  };

  const handleOpenModal = (e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled) return;
    const parts = (localValue || value || '').split(':');
    setModalHour(parts[0] || new Date().getHours().toString().padStart(2, '0'));
    setModalMinute(parts[1] || '00');
    setShowModal(true);
  };

  const handleConfirmModal = () => {
    const formatted = `${modalHour.padStart(2, '0')}:${modalMinute.padStart(2, '0')}`;
    setLocalValue(formatted);
    onChange(formatted);
    if (inputRef.current) {
      inputRef.current.value = formatted;
    }
    setShowModal(false);
  };

  const handleSetNow = () => {
    const now = new Date();
    const h = now.getHours().toString().padStart(2, '0');
    const m = now.getMinutes().toString().padStart(2, '0');
    const formatted = `${h}:${m}`;
    setLocalValue(formatted);
    onChange(formatted);
    if (inputRef.current) {
      inputRef.current.value = formatted;
    }
    setShowModal(false);
  };

  const handleSelectPreset = (presetTime: string) => {
    setLocalValue(presetTime);
    onChange(presetTime);
    if (inputRef.current) {
      inputRef.current.value = presetTime;
    }
    setShowModal(false);
  };

  const shiftPresets = shift && SHIFT_HOURS[shift] ? SHIFT_HOURS[shift] : [];

  return (
    <div className="relative inline-flex items-center w-full">
      <div className="relative flex items-center w-full">
        <input
          ref={inputRef}
          id={id}
          type="time"
          step="60"
          value={localValue}
          onChange={handleManualChange}
          onInput={handleManualChange}
          disabled={disabled}
          className={clsx(
            "w-full pr-9 font-semibold text-neutral-800 bg-white border border-neutral-300 rounded-lg outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all",
            className
          )}
        />
        {!disabled && (
          <button
            type="button"
            onClick={handleOpenModal}
            className="absolute right-2 p-1.5 text-neutral-400 hover:text-neutral-700 active:scale-90 transition-transform"
            title="Abrir seletor rápido para definir horário"
          >
            <Clock size={16} />
          </button>
        )}
      </div>

      {/* Modal / Quick Picker Popup */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div 
            className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-neutral-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-3 border-b border-neutral-100">
              <h3 className="font-bold text-neutral-800 flex items-center gap-2">
                <Clock size={18} className="text-orange-500" />
                <span>Definir Horário</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-full"
              >
                <X size={18} />
              </button>
            </div>

            {label && (
              <p className="text-xs text-neutral-500 mt-2">{label}</p>
            )}

            {/* Display & Stepper */}
            <div className="my-5 flex items-center justify-center gap-3 bg-neutral-50 p-4 rounded-xl border border-neutral-200">
              <div className="flex flex-col items-center">
                <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1">Hora</label>
                <select
                  value={modalHour}
                  onChange={(e) => setModalHour(e.target.value)}
                  className="bg-white border-2 border-neutral-300 rounded-xl px-3 py-2 text-2xl font-black text-neutral-800 text-center outline-none focus:border-orange-500 shadow-sm"
                >
                  {Array.from({ length: 24 }).map((_, i) => {
                    const h = i.toString().padStart(2, '0');
                    return (
                      <option key={h} value={h}>
                        {h}h
                      </option>
                    );
                  })}
                </select>
              </div>

              <span className="text-3xl font-black text-neutral-400 mt-4">:</span>

              <div className="flex flex-col items-center">
                <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1">Minuto</label>
                <select
                  value={modalMinute}
                  onChange={(e) => setModalMinute(e.target.value)}
                  className="bg-white border-2 border-neutral-300 rounded-xl px-3 py-2 text-2xl font-black text-neutral-800 text-center outline-none focus:border-orange-500 shadow-sm"
                >
                  {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Shift Presets */}
            {shiftPresets.length > 0 && (
              <div className="mb-4">
                <label className="block text-xs font-bold text-neutral-600 mb-2">
                  Horários do Turno {shift}:
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {shiftPresets.map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => handleSelectPreset(time)}
                      className={clsx(
                        "py-2 rounded-lg text-xs font-bold border transition-colors",
                        localValue === time
                          ? "bg-neutral-900 text-white border-neutral-900"
                          : "bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border-neutral-200"
                      )}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={handleSetNow}
                className="flex-1 py-3 px-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-xl text-xs active:scale-95 transition-all"
              >
                Hora Atual
              </button>

              <button
                type="button"
                onClick={handleConfirmModal}
                className="flex-1 py-3 px-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-1.5 active:scale-95 shadow-md shadow-orange-200 transition-all"
              >
                <Check size={16} className="stroke-[3]" />
                <span>Definir</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
