import { supabase } from './supabaseClient';
import { OfflineStorageService } from './OfflineStorageService';

export const getDayName = (d = new Date()) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[d.getDay()];
};

export const getCurrentTime = (d = new Date()) => {
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

export const isAreaAccessibleForUser = (area, userType) => {
  if (!area) return false;

  const normalizedType = userType ? String(userType).trim().toLowerCase() : '';
  if (
    normalizedType === 'superadmin' ||
    normalizedType === 'admin' ||
    normalizedType === 'super_admin' ||
    normalizedType === 'owner'
  ) {
    return true;
  }

  // enable_day check: if disabled, null, undefined, false, 0, or 'false', always allow!
  const enableDay =
    area.enable_day === true ||
    area.enable_day === 'true' ||
    area.enable_day === 1 ||
    area.enable_day === '1';

  if (!enableDay) {
    return true;
  }

  // Day check
  const currentDay = new Date();
  const currentFullDay = getDayName(currentDay).toLowerCase(); // 'monday', 'tuesday', ...
  const currentShortDay = currentFullDay.substring(0, 3); // 'mon', 'tue', ...
  const currentDayNum0 = String(currentDay.getDay()); // 0 (Sun) to 6 (Sat)
  const currentDayNum1 = String(currentDay.getDay() === 0 ? 7 : currentDay.getDay()); // 1 (Mon) to 7 (Sun)

  if (area.day_of_week) {
    const configuredDays = String(area.day_of_week)
      .split(',')
      .map(d => d.trim().toLowerCase());

    const isDayMatched = configuredDays.some(
      d =>
        d === currentFullDay ||
        d === currentShortDay ||
        d === currentDayNum0 ||
        d === currentDayNum1 ||
        currentFullDay.startsWith(d)
    );

    if (!isDayMatched) {
      return false;
    }
  }

  // Time check
  const startTimeRaw = area.start_time_filter ? String(area.start_time_filter).trim() : '';
  const endTimeRaw = area.end_time_filter ? String(area.end_time_filter).trim() : '';

  if (!startTimeRaw && !endTimeRaw) {
    return true;
  }

  const formatTime = (t) => {
    if (!t) return '';
    const match = t.match(/(\d{1,2}):(\d{2})/);
    if (!match) return t.substring(0, 5);
    return `${match[1].padStart(2, '0')}:${match[2]}`;
  };

  const startTime = formatTime(startTimeRaw);
  const endTime = formatTime(endTimeRaw);
  const currentTime = getCurrentTime();

  if (startTime === '00:00' && (endTime === '00:00' || endTime === '23:59' || !endTime)) {
    return true;
  }

  if (startTime && endTime) {
    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Range crosses midnight (e.g. 22:00 to 04:00)
      return currentTime >= startTime || currentTime <= endTime;
    }
  } else if (startTime) {
    return currentTime >= startTime;
  } else if (endTime) {
    return currentTime <= endTime;
  }

  return true;
};

export const fetchAreasForUser = async ({ userId, userType }) => {
  const normalizedType = userType ? String(userType).trim().toLowerCase() : '';
  const isAdmin =
    normalizedType === 'superadmin' ||
    normalizedType === 'admin' ||
    normalizedType === 'super_admin' ||
    normalizedType === 'owner';

  // 1. Direct Supabase query
  try {
    if (isAdmin) {
      const { data, error } = await supabase
        .from('area_master')
        .select('*')
        .order('area_name', { ascending: true });

      if (!error && data && data.length > 0) {
        await OfflineStorageService.saveOfflineAreas(data);
        return data;
      }
    } else {
      const areaMap = new Map();

      if (userId) {
        // Query user_groups to get group_ids for this user
        const { data: userGroups, error: ugError } = await supabase
          .from('user_groups')
          .select('group_id')
          .eq('user_id', userId);

        if (!ugError && userGroups && userGroups.length > 0) {
          const groupIds = userGroups.map(ug => ug.group_id).filter(Boolean);

          if (groupIds.length > 0) {
            // Query group_areas table for assigned area_ids
            const { data: groupAreas } = await supabase
              .from('group_areas')
              .select('area_id')
              .in('group_id', groupIds);

            // Query groups table for directly linked area_id
            const { data: groupsWithArea } = await supabase
              .from('groups')
              .select('area_id')
              .in('id', groupIds);

            const groupAreaIds = [
              ...(groupAreas || []).map(ga => ga.area_id),
              ...(groupsWithArea || []).map(g => g.area_id),
            ].filter(Boolean);

            const uniqueAreaIds = [...new Set(groupAreaIds)];

            if (uniqueAreaIds.length > 0) {
              const { data: areaRecords, error: arError } = await supabase
                .from('area_master')
                .select('*')
                .in('id', uniqueAreaIds)
                .order('area_name', { ascending: true });

              if (!arError && areaRecords && areaRecords.length > 0) {
                areaRecords.forEach(a => areaMap.set(a.id, a));
              }
            }
          }
        }
      }

      // If no group-specific areas were found, load all active areas from area_master
      if (areaMap.size === 0) {
        const { data: allAreas, error: allErr } = await supabase
          .from('area_master')
          .select('*')
          .order('area_name', { ascending: true });

        if (!allErr && allAreas && allAreas.length > 0) {
          allAreas.forEach(a => areaMap.set(a.id, a));
        }
      }

      const allFoundAreas = Array.from(areaMap.values());
      const accessibleAreas = allFoundAreas.filter(area => isAreaAccessibleForUser(area, userType));
      const result = accessibleAreas.length > 0 ? accessibleAreas : allFoundAreas;

      if (allFoundAreas.length > 0) {
        await OfflineStorageService.saveOfflineAreas(allFoundAreas);
      }

      if (result.length > 0) {
        return result;
      }
    }
  } catch (onlineError) {
    console.warn('AreaService: Online fetch failed, falling back to offline storage:', onlineError);
  }

  // 2. Offline storage fallback
  try {
    const offlineAreas = await OfflineStorageService.getOfflineAreas();
    if (offlineAreas && offlineAreas.length > 0) {
      const filtered = offlineAreas.filter(area => isAreaAccessibleForUser(area, userType));
      return filtered.length > 0 ? filtered : offlineAreas;
    }
  } catch (offlineError) {
    console.error('AreaService: Offline storage fetch failed:', offlineError);
  }

  return [];
};
