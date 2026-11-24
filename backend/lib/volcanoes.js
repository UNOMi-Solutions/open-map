// USGS Volcano Hazards Program, Hazard Notification System (HANS) public API.
// The volcano list has locations and the NVEWS threat ranking; the monitored list has the
// current alert level from each volcano's most recent notice. Joined on the volcano number (vnum).
import axios from "axios";
import { getCached } from "../utils/dataCache.js";

const HANS_API = "https://volcanoes.usgs.gov/hans-public/api/volcano/";
const CACHE_MS = 30 * 60 * 1000;

// USGS Volcano Alert Levels in increasing severity; volcanoes without a monitoring network have none
export const VOLCANO_ALERT_LEVELS = ["NORMAL", "ADVISORY", "WATCH", "WARNING"];

async function buildVolcanoes() {
    const [{ data: volcanoes }, { data: monitored }] = await Promise.all([
        axios.get(HANS_API + "getUsVolcanoes", { timeout: 60000 }),
        axios.get(HANS_API + "getMonitoredVolcanoes", { timeout: 60000 }),
    ]);

    const statusByVnum = new Map(
        (monitored ?? []).filter(m => m.vnum).map(m => [m.vnum, m])
    );

    const result = (volcanoes ?? [])
        .filter(v => Number.isFinite(v.latitude) && Number.isFinite(v.longitude))
        .map(v => {
            const status = statusByVnum.get(v.vnum);
            const alertLevel = VOLCANO_ALERT_LEVELS.includes(status?.alert_level) ? status.alert_level : null;
            return {
                id: v.vnum,
                name: v.volcano_name,
                region: v.region,
                observatory: v.obs_fullname,
                latitude: v.latitude,
                longitude: v.longitude,
                elevationMeters: v.elevation_meters,
                threat: v.nvews_threat || null,
                alertLevel,
                aviationColorCode: alertLevel ? status.color_code : null,
                lastNoticeTime: alertLevel ? status.sent_unixtime * 1000 : null,
                noticeUrl: alertLevel ? status.notice_url : null,
                volcanoUrl: v.volcano_url || null,
            };
        });

    return {
        source: "USGS Volcano Hazards Program",
        alertLevels: VOLCANO_ALERT_LEVELS,
        totalVolcanoes: result.length,
        volcanoes: result,
    };
}

export function getVolcanoes() {
    return getCached("volcanoes:us", CACHE_MS, buildVolcanoes);
}
