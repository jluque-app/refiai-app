/**
 * Episode intro videos ("The Professor's Briefing").
 *
 * Each value is the Google Drive FILE ID of that episode's finished video.
 * Hosted on the allretech.org Drive (NOT the ESCP Workspace, which cannot share
 * outside its domain), shared "Anyone with the link → Viewer". Verified public
 * 20 Sept 2026 by filename lookup on each id.
 *
 * To replace one: upload the mp4 to the allretech Drive, share it, copy the id
 * out of  https://drive.google.com/file/d/<THIS_PART>/view  and paste it below.
 * Set to null to hide the intro for that episode.
 */
export const EPISODE_VIDEOS: Record<string, string | null> = {
    E1_VALENCIA: "1AOuWcgnIXLLFzBAWskV1SQFrbRxaF3Ru", // E1_Valencia_Professors_Briefing.mp4
    E2_MADRID: "12rfsif1mw_P2vkzfs0b5Qx4AFHbVs9yx",   // E2_Madrid_Professors_Briefing.mp4
    E3_BARCELONA: "15ZJldNL8qXqU43Vvs7_FhkwbsynYHiMf", // E3_Barcelona_Professors_Briefing.mp4
    E4_MIAMI: "1XhcKSpnqAu98ZqaV4cULQAKrEvZtmzIF",    // E4_Miami_Professors_Briefing.mp4
    E5_NYC: "19uPh5hA18xD8HlOhMn5jq4s-n16hLk9u",      // E5_NewYork_Professors_Briefing.mp4
    E6_LONDON: "1vO3bd4XQeBsQaSxQg06_OJZIMm4LpDgm",   // E6_London_Professors_Briefing.mp4
    E7_PARIS: "1FydqtoheIvbDSgmR7taC2HJ292aww0_O",    // E7_Paris_Professors_Briefing.mp4 (Season 2)
};

/** Build the embeddable preview URL for a Drive file id. */
export function driveEmbedUrl(fileId: string): string {
    return `https://drive.google.com/file/d/${fileId}/preview`;
}
