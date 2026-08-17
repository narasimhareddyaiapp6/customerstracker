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

export const fetchAreasForUser = async ({ userId, userType } = {}) => {
  let currentUserId = userId;
  let resolvedUserType = userType;

  // 1. If userId wasn't provided, resolve from active auth session
  if (!currentUserId) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user?.id) {
        currentUserId = sessionData.session.user.id;
        if (!resolvedUserType) {
          resolvedUserType = sessionData.session.user.user_metadata?.user_type;
        }
      }
    } catch (e) {
      console.warn('AreaService: Could not resolve session user id:', e);
    }
  }

  // 2. If userType wasn't provided or is undefined, resolve it from the 'users' table using currentUserId
  if (!resolvedUserType && currentUserId) {
    try {
      const { data: userData, error: userErr } = await supabase
        .from('users')
        .select('user_type')
        .eq('id', currentUserId)
        .maybeSingle();

      if (!userErr && userData?.user_type) {
        resolvedUserType = userData.user_type;
      }
    } catch (e) {
      console.warn('AreaService: Could not resolve user_type from DB:', e);
    }
  }

  const normalizedType = resolvedUserType ? String(resolvedUserType).trim().toLowerCase() : 'user';
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
        await OfflineStorageService.saveOfflineAreas(data, currentUserId);
        return data;
      }
      return data || [];
    } else {
      // Regular user (user_type === 'user' or non-admin): ONLY show areas assigned to user's group(s)
      if (!currentUserId) {
        return [];
      }

      const areaMap = new Map();

      // Query user_groups to get group_ids for this user
      const { data: userGroups, error: ugError } = await supabase
        .from('user_groups')
        .select('group_id')
        .eq('user_id', currentUserId);

      if (ugError) {
        console.error('AreaService: Error fetching user_groups:', ugError);
        await OfflineStorageService.saveOfflineAreas([], currentUserId);
        return [];
      }

      if (!userGroups || userGroups.length === 0) {
        // User has no assigned group -> Return empty array (do NOT show any areas)
        await OfflineStorageService.saveOfflineAreas([], currentUserId);
        return [];
      }

      const groupIds = userGroups.map(ug => ug.group_id).filter(Boolean);

      if (groupIds.length === 0) {
        await OfflineStorageService.saveOfflineAreas([], currentUserId);
        return [];
      }

      // Query group_areas table for assigned area_ids
      const { data: groupAreas, error: gaError } = await supabase
        .from('group_areas')
        .select('area_id')
        .in('group_id', groupIds);

      if (gaError) {
        console.error('AreaService: Error fetching group_areas:', gaError);
      }

      // Query groups table for directly linked area_id
      const { data: groupsWithArea, error: gwaError } = await supabase
        .from('groups')
        .select('area_id')
        .in('id', groupIds);

      if (gwaError) {
        console.error('AreaService: Error fetching groups area_id:', gwaError);
      }

      const groupAreaIds = [
        ...(groupAreas || []).map(ga => ga.area_id),
        ...(groupsWithArea || []).map(g => g.area_id),
      ].filter(Boolean);

      const uniqueAreaIds = [...new Set(groupAreaIds)];

      if (uniqueAreaIds.length === 0) {
        // User's group(s) have no assigned areas -> Return empty array (do NOT show any areas)
        await OfflineStorageService.saveOfflineAreas([], currentUserId);
        return [];
      }

      const { data: areaRecords, error: arError } = await supabase
        .from('area_master')
        .select('*')
        .in('id', uniqueAreaIds)
        .order('area_name', { ascending: true });

      if (arError) {
        console.error('AreaService: Error fetching area_master records for group:', arError);
        await OfflineStorageService.saveOfflineAreas([], currentUserId);
        return [];
      }

      if (areaRecords && areaRecords.length > 0) {
        areaRecords.forEach(a => areaMap.set(a.id, a));
      }

      const assignedAreas = Array.from(areaMap.values());
      const accessibleAreas = assignedAreas.filter(area => isAreaAccessibleForUser(area, resolvedUserType));

      await OfflineStorageService.saveOfflineAreas(accessibleAreas, currentUserId);
      return accessibleAreas;
    }
  } catch (onlineError) {
    console.warn('AreaService: Online fetch failed, falling back to offline storage:', onlineError);
  }

  // 2. Offline storage fallback
  try {
    const offlineAreas = await OfflineStorageService.getOfflineAreas(currentUserId);
    if (offlineAreas && offlineAreas.length > 0) {
      if (isAdmin) {
        return offlineAreas;
      }
      // For non-admin user, strictly filter by accessibility
      const filtered = offlineAreas.filter(area => isAreaAccessibleForUser(area, resolvedUserType));
      return filtered;
    }
  } catch (offlineError) {
    console.error('AreaService: Offline storage fetch failed:', offlineError);
  }

  return [];
};
