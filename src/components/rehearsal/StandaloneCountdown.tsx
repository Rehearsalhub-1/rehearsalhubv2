import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  programDate?: string;
  programCountdownObj?: any;
  programUpdatedAt?: any;
  styles: any;
}

export const StandaloneCountdown: React.FC<Props> = ({ programDate, programCountdownObj, programUpdatedAt, styles }) => {
  const [countdown, setCountdown] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let interval: NodeJS.Timeout | null = null;

    const parseProgramDate = (dateStr: string | undefined): Date | null => {
      if (!dateStr) return null;
      try {
        let cleaned = dateStr.replace(/(\d+)(st|nd|rd|th)/i, '$1');
        cleaned = cleaned.replace(/monday|tuesday|wednesday|thursday|friday|saturday|sunday/gi, '');
        cleaned = cleaned.replace(/,/g, '').trim();
        const now = new Date();
        const currentYear = now.getFullYear();
        let date = new Date(cleaned);
        if (isNaN(date.getTime()) || !/\d{4}/.test(cleaned)) {
          const parts = cleaned.split(' ').filter(Boolean);
          if (parts.length >= 2) {
            const p1 = parts[0];
            const p2 = parts[1];
            const p3 = parts[2] || currentYear;
            if (!isNaN(Number(p1))) {
              date = new Date(`${p2} ${p1}, ${p3}`);
            } else {
              date = new Date(`${p1} ${p2}, ${p3}`);
            }
          }
        }
        if (!isNaN(date.getTime())) {
          if (date.getTime() < now.getTime() - 30 * 24 * 60 * 60 * 1000) {
            date.setFullYear(date.getFullYear() + 1);
          }
          return date;
        }
        return null;
      } catch (e) {
        return null;
      }
    };

    const initializeCountdown = async () => {
      let targetDate: Date | null = null;
      const now = new Date();
      const parsedProgramDate = parseProgramDate(programDate);
      if (parsedProgramDate) {
        if (programDate && programDate.indexOf(':') === -1 && parsedProgramDate.getHours() === 0) {
          parsedProgramDate.setHours(17, 0, 0, 0);
        }
        if (parsedProgramDate.getTime() > now.getTime()) {
          targetDate = parsedProgramDate;
        }
      }
      if (!targetDate && programCountdownObj) {
        const durationMs =
          (programCountdownObj.days || 0) * 86400000 +
          (programCountdownObj.hours || 0) * 3600000 +
          (programCountdownObj.minutes || 0) * 60000 +
          (programCountdownObj.seconds || 0) * 1000;
        if (durationMs > 0) {
          const baseDate = programUpdatedAt ? new Date(programUpdatedAt).getTime() : now.getTime();
          if (!isNaN(baseDate)) {
            const calculatedTarget = new Date(baseDate + durationMs);
            if (calculatedTarget.getTime() > now.getTime()) {
              targetDate = calculatedTarget;
            }
          }
        }
      }
      if (!active) return;
      if (!targetDate || isNaN(targetDate.getTime())) {
        setCountdown(null);
        return;
      }
      const updateCountdown = () => {
        const now = new Date();
        const diff = targetDate!.getTime() - now.getTime();
        if (diff <= 0) {
          setCountdown(null);
          if (interval) clearInterval(interval);
          return;
        }
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor(diff / (1000 * 60 * 60) % 24);
        const mins = Math.floor(diff / 1000 / 60 % 60);
        const secs = Math.floor(diff / 1000 % 60);
        if (days > 0) {
          setCountdown(`${days}d ${hours}h ${mins}m ${secs}s`);
        } else {
          setCountdown(`${hours}h ${mins}m ${secs}s`);
        }
      };
      updateCountdown();
      interval = setInterval(updateCountdown, 1000);
    };

    initializeCountdown();
    return () => {
      active = false;
      if (interval) clearInterval(interval);
    };
  }, [programDate, programCountdownObj, programUpdatedAt]);

  if (!countdown) return null;

  return (
    <View style={[styles.countdownBadge, { position: 'relative', alignSelf: 'flex-start', bottom: 0, right: 0, marginBottom: 12 }]}>
      <Ionicons name="time" size={14} color="#38bdf8" />
      <Text style={styles.countdownText}>{countdown}</Text>
    </View>
  );
};
