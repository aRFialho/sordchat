const birthdaySeparators = /[-/.]/;

export const parseBirthday = (value) => {
  if (!value) {
    return null;
  }

  const parts = String(value).trim().split(birthdaySeparators).map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) {
    return null;
  }

  let month;
  let day;

  if (parts.length >= 3) {
    [, month, day] = parts;
  } else if (parts.length === 2) {
    const [first, second] = parts;
    if (first > 12 && second <= 12) {
      day = first;
      month = second;
    } else {
      month = first;
      day = second;
    }
  }

  if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  return { month, day };
};

export const formatBirthday = (value) => {
  const birthday = parseBirthday(value);
  if (!birthday) {
    return value || '';
  }

  return `${String(birthday.day).padStart(2, '0')}/${String(birthday.month).padStart(2, '0')}`;
};

const buildDateForYear = (birthday, year) => new Date(year, birthday.month - 1, birthday.day);

export const isBirthdayToday = (value, baseDate = new Date()) => {
  const birthday = parseBirthday(value);
  if (!birthday) {
    return false;
  }

  return birthday.month === baseDate.getMonth() + 1 && birthday.day === baseDate.getDate();
};

export const getBirthdayTiming = (value, baseDate = new Date()) => {
  const birthday = parseBirthday(value);
  if (!birthday) {
    return null;
  }

  const today = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  let nextDate = buildDateForYear(birthday, today.getFullYear());
  if (nextDate < today) {
    nextDate = buildDateForYear(birthday, today.getFullYear() + 1);
  }

  let lastDate = buildDateForYear(birthday, today.getFullYear());
  if (lastDate > today) {
    lastDate = buildDateForYear(birthday, today.getFullYear() - 1);
  }

  const dayMs = 24 * 60 * 60 * 1000;
  return {
    nextDate,
    lastDate,
    daysUntil: Math.round((nextDate - today) / dayMs),
    daysSince: Math.round((today - lastDate) / dayMs),
    isToday: nextDate.getTime() === today.getTime(),
  };
};

export const sortBirthdays = (users, baseDate = new Date()) => {
  const withTiming = users
    .map((user) => ({ ...user, birthdayTiming: getBirthdayTiming(user.birthday, baseDate) }))
    .filter((user) => user.birthdayTiming);

  return {
    today: withTiming
      .filter((user) => user.birthdayTiming.isToday)
      .sort((a, b) => (a.full_name || a.username || '').localeCompare(b.full_name || b.username || '')),
    upcoming: [...withTiming]
      .sort((a, b) => a.birthdayTiming.daysUntil - b.birthdayTiming.daysUntil)
      .slice(0, 8),
    recent: [...withTiming]
      .filter((user) => !user.birthdayTiming.isToday)
      .sort((a, b) => a.birthdayTiming.daysSince - b.birthdayTiming.daysSince)
      .slice(0, 8),
  };
};
