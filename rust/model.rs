use chrono::NaiveDate;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(
    Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, JsonSchema,
)]
#[serde(rename_all = "lowercase")]
pub enum Member {
    Luzao,
    Youen,
    Yumo,
    Waner,
    Minuo,
}
pub const MEMBERS: [Member; 5] = [
    Member::Luzao,
    Member::Youen,
    Member::Yumo,
    Member::Waner,
    Member::Minuo,
];

impl Member {
    pub fn label(self) -> &'static str {
        match self {
            Self::Luzao => "露早",
            Self::Youen => "柚恩",
            Self::Yumo => "虞莫",
            Self::Waner => "莞儿",
            Self::Minuo => "米诺",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, JsonSchema)]
#[serde(transparent)]
pub struct Bvid(#[schemars(regex(pattern = r"^BV[0-9A-Za-z]{10}$"))] String);
impl Bvid {
    pub fn as_str(&self) -> &str {
        &self.0
    }
}
impl std::str::FromStr for Bvid {
    type Err = anyhow::Error;
    fn from_str(value: &str) -> Result<Self, Self::Err> {
        anyhow::ensure!(
            value.len() == 12
                && value.starts_with("BV")
                && value.bytes().skip(2).all(|b| b.is_ascii_alphanumeric()),
            "invalid BV identity"
        );
        Ok(Self(value.to_owned()))
    }
}
impl<'de> Deserialize<'de> for Bvid {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        String::deserialize(deserializer)?
            .parse()
            .map_err(serde::de::Error::custom)
    }
}
impl std::fmt::Display for Bvid {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}
impl std::borrow::Borrow<str> for Bvid {
    fn borrow(&self) -> &str {
        &self.0
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "kebab-case", deny_unknown_fields)]
pub enum Asset {
    Video {
        #[schemars(regex(pattern = r"^BV[0-9A-Za-z]{10}$"))]
        bvid: Bvid,
        #[serde(default, rename = "partNumbers")]
        part_numbers: Vec<std::num::NonZeroU32>,
        role: Option<String>,
        #[serde(default)]
        notes: Vec<String>,
    },
    Link {
        url: String,
        role: Option<String>,
        #[serde(default)]
        notes: Vec<String>,
    },
}
impl Asset {
    pub fn bvid(&self) -> Option<&Bvid> {
        match self {
            Self::Video { bvid, .. } => Some(bvid),
            Self::Link { .. } => None,
        }
    }
    pub fn part_numbers(&self) -> &[std::num::NonZeroU32] {
        match self {
            Self::Video { part_numbers, .. } => part_numbers,
            Self::Link { .. } => &[],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Guest {
    pub account_id: std::num::NonZeroU64,
    pub name: String,
    pub url: String,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum Dimension {
    #[serde(rename = "1d")]
    One,
    #[serde(rename = "2d")]
    Two,
    #[serde(rename = "3d")]
    Three,
    Unknown,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "kebab-case")]
pub enum ContentType {
    Talk,
    Singing,
    Dance,
    Radio,
    Game,
    Lesson,
    Celebration,
    Special,
    Mixed,
    Unknown,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "kebab-case")]
pub enum EventKind {
    Livestream,
    Activity,
    Publication,
    Announcement,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "kebab-case")]
pub enum EvidenceBasis {
    Recording,
    Publication,
    Announcement,
    OfficialPost,
    Source,
    Clip,
    Report,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Stage {
    pub title: String,
    pub dimension: Dimension,
    #[schemars(inner(range(max = 23)))]
    pub title_hours: Vec<u8>,
    pub recording_bvids: Vec<Bvid>,
}
#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "kebab-case")]
pub enum RelationKind {
    Related,
    Announces,
    ChangesPlan,
    ExcerptFrom,
    Cancels,
    PerformanceFrom,
    SupplementsTicketing,
    Changes,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "kebab-case", deny_unknown_fields)]
pub enum RecordReference {
    Event { id: String },
    PlanEntry { id: String },
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EventRelation {
    pub kind: RelationKind,
    pub target: RecordReference,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DateClaim {
    pub date: NaiveDate,
    pub sources: Vec<Source>,
    pub notes: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "kebab-case")]
pub enum SegmentKind {
    PlaybackIncident,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Segment {
    pub title: String,
    #[serde(rename = "type")]
    pub kind: Option<SegmentKind>,
    pub work_id: Option<String>,
    pub credited_performers: Vec<String>,
    pub assets: Vec<Asset>,
    pub sources: Vec<Source>,
    pub notes: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Event {
    #[schemars(length(min = 1))]
    pub id: String,
    pub date: NaiveDate,
    pub end_date: Option<NaiveDate>,
    #[schemars(length(min = 1))]
    pub title: String,
    pub kind: EventKind,
    pub basis: EvidenceBasis,
    #[serde(default)]
    pub recording_named_members: Vec<Member>,
    #[serde(default)]
    pub planned_members: Vec<Member>,
    #[serde(default)]
    pub credited_members: Vec<Member>,
    #[serde(default)]
    pub announced_members: Vec<Member>,
    #[serde(default)]
    pub absent_members: Vec<Member>,
    #[serde(default)]
    pub credited_performers: Vec<String>,
    pub credited_group: Option<String>,
    pub host_member: Option<Member>,
    #[serde(default)]
    pub related_works: Vec<String>,
    #[serde(default)]
    pub relations: Vec<EventRelation>,
    #[serde(default)]
    pub plan_ids: Vec<String>,
    #[serde(default)]
    pub recordings: Vec<Asset>,
    #[serde(default)]
    pub assets: Vec<Asset>,
    #[schemars(regex(pattern = r"^BV[0-9A-Za-z]{10}$"))]
    pub preferred_recording_bvid: Option<Bvid>,
    pub content_type: Option<ContentType>,
    pub dimension: Option<Dimension>,
    pub series: Option<String>,
    pub is_unannounced: Option<bool>,
    pub location: Option<String>,
    pub text: Option<String>,
    pub published_at: Option<chrono::DateTime<chrono::Utc>>,
    pub announcement_published_at: Option<chrono::DateTime<chrono::Utc>>,
    pub planned_time: Option<ClockTime>,
    pub planned_room_id: Option<std::num::NonZeroU64>,
    #[serde(default)]
    pub title_hours: Vec<u8>,
    #[serde(default)]
    pub guests: Vec<Guest>,
    #[serde(default)]
    pub stages: Vec<Stage>,
    #[serde(default)]
    pub recording_date_claims: Vec<DateClaim>,
    #[serde(default)]
    pub segments: Vec<Segment>,
    #[serde(default)]
    pub sources: Vec<Source>,
    #[serde(default)]
    pub notes: Vec<String>,
}
impl Event {
    pub fn dates(&self) -> impl Iterator<Item = NaiveDate> + '_ {
        let last = self.end_date.unwrap_or(self.date);
        self.date.iter_days().take_while(move |date| *date <= last)
    }
    pub fn contains_date(&self, date: NaiveDate) -> bool {
        self.date <= date && date <= self.end_date.unwrap_or(self.date)
    }
}
#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "kebab-case")]
pub enum WorkKind {
    Song,
    OriginalSong,
    DanceMedley,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Credit {
    pub name: String,
    pub role: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Work {
    #[schemars(length(min = 1))]
    pub id: String,
    #[schemars(length(min = 1))]
    pub title: String,
    #[serde(default)]
    pub aliases: Vec<String>,
    #[serde(default)]
    pub original_artists: Vec<String>,
    pub kind: Option<WorkKind>,
    pub series: Option<String>,
    #[serde(default)]
    pub credits: Vec<Credit>,
    #[serde(default)]
    pub sources: Vec<Source>,
    #[serde(default)]
    pub notes: Vec<String>,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "kebab-case")]
pub enum PerformanceKind {
    Singing,
    Dance,
    SingingAndDance,
    Instrumental,
}
#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "kebab-case")]
pub enum PerformanceRole {
    Singing,
    Dance,
    Instrumental,
    SingingAndInstrumental,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MemberRole {
    pub member: Member,
    pub role: PerformanceRole,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Performance {
    #[schemars(length(min = 1))]
    pub id: String,
    pub date: NaiveDate,
    #[schemars(length(min = 1))]
    pub event_id: String,
    #[schemars(length(min = 1))]
    pub work_id: String,
    #[serde(rename = "type")]
    pub kind: PerformanceKind,
    #[serde(default)]
    pub credited_members: Vec<Member>,
    pub credited_group: Option<String>,
    #[serde(default)]
    pub credited_performers: Vec<String>,
    #[serde(default)]
    pub video_credited_members: Vec<Member>,
    #[serde(default)]
    pub member_roles: Vec<MemberRole>,
    pub stage_name: Option<String>,
    pub instrument: Option<String>,
    pub reference_artist: Option<String>,
    pub assets: Vec<Asset>,
    #[serde(default)]
    pub sources: Vec<Source>,
    #[serde(default)]
    pub notes: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TitleSession {
    pub date: NaiveDate,
    #[schemars(range(max = 23))]
    pub hour: Option<u8>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Uploader {
    pub name: Option<String>,
    pub account_id: Option<std::num::NonZeroU64>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RecordingPart {
    pub number: std::num::NonZeroU32,
    pub content_id: Option<std::num::NonZeroU64>,
    pub title: String,
    pub duration_seconds: Option<u32>,
    pub version: Option<String>,
    pub segment: Option<std::num::NonZeroU32>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Recording {
    #[schemars(regex(pattern = r"^BV[0-9A-Za-z]{10}$"))]
    pub bvid: Bvid,
    #[schemars(length(min = 1))]
    pub title: String,
    pub title_session: TitleSession,
    pub uploader: Uploader,
    pub published_at: Option<chrono::DateTime<chrono::Utc>>,
    pub duration_seconds: Option<u32>,
    pub format_label: Option<String>,
    #[serde(default)]
    pub parts: Vec<RecordingPart>,
    #[serde(default)]
    pub sources: Vec<Source>,
    #[serde(default)]
    pub notes: Vec<String>,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "kebab-case")]
pub enum PlanKind {
    Livestream,
    Activity,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PlanEntry {
    #[schemars(length(min = 1))]
    pub id: String,
    pub kind: PlanKind,
    pub arrangement: Arrangement,
    pub related_event_ids: Vec<String>,
    pub sources: Vec<Source>,
    pub notes: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Plan {
    #[schemars(length(min = 1))]
    pub id: String,
    pub date: NaiveDate,
    pub rest_day: Option<bool>,
    #[serde(default)]
    pub entries: Vec<PlanEntry>,
    #[serde(default)]
    pub non_stream_activities: Vec<String>,
    #[serde(default)]
    pub sources: Vec<Source>,
    #[serde(default)]
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Source {
    pub url: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
#[serde(transparent)]
pub struct ClockTime(#[schemars(regex(pattern = r"^([01][0-9]|2[0-3]):[0-5][0-9]$"))] String);
impl<'de> Deserialize<'de> for ClockTime {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let value = String::deserialize(deserializer)?;
        let time =
            chrono::NaiveTime::parse_from_str(&value, "%H:%M").map_err(serde::de::Error::custom)?;
        if time.format("%H:%M").to_string() != value {
            return Err(serde::de::Error::custom("expected HH:MM"));
        }
        Ok(Self(value))
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "kebab-case")]
pub enum Participation {
    Individual,
    Collaboration,
    Group,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Room {
    pub account_id: Option<std::num::NonZeroU64>,
    pub host_member: Option<Member>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "kebab-case")]
pub enum TimeRelation {
    SameAsOriginal,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Arrangement {
    pub planned_time: Option<ClockTime>,
    pub planned_end_time: Option<ClockTime>,
    pub title: Option<String>,
    pub members: Vec<Member>,
    pub format_label: Option<String>,
    pub participation: Option<Participation>,
    pub host_member: Option<Member>,
    pub room_id: Option<std::num::NonZeroU64>,
    pub room: Option<Room>,
    pub member_count: Option<std::num::NonZeroU8>,
    pub delay_minutes: Option<std::num::NonZeroU32>,
    pub time_relation: Option<TimeRelation>,
    #[serde(default)]
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Schedule {
    pub date: Option<NaiveDate>,
    pub rest_day: Option<bool>,
    pub events: Vec<Arrangement>,
    pub non_stream_activities: Vec<String>,
    #[serde(default)]
    pub sources: Vec<Source>,
    #[serde(default)]
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "kebab-case", deny_unknown_fields)]
pub enum ChangeImpact {
    Dates { dates: Vec<NaiveDate> },
    Range { from: NaiveDate, through: NaiveDate },
    Ongoing { from: NaiveDate },
    Undated,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "kebab-case")]
pub enum ChangeAction {
    Cancellation,
    Reschedule,
    Postponement,
    Absence,
    TentativeAbsence,
    LineupChange,
    ScheduleAnnouncement,
    TimeChange,
    FormatChange,
    ScheduleRevision,
    AdditionalStream,
    RoomChange,
    ActivityPause,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Change {
    #[schemars(length(min = 1))]
    pub id: String,
    pub action: ChangeAction,
    pub impact: ChangeImpact,
    pub announced_on: Option<NaiveDate>,
    pub title: Option<String>,
    pub text: Option<String>,
    pub members: Vec<Member>,
    pub before: Vec<Schedule>,
    pub after: Vec<Schedule>,
    pub event_ids: Vec<String>,
    pub announcement_event_ids: Vec<String>,
    pub plan_ids: Vec<String>,
    pub plan_entry_ids: Vec<String>,
    #[serde(default)]
    pub replaces_change_ids: Vec<String>,
    pub notes: Vec<String>,
    pub sources: Vec<Source>,
}
impl Change {
    pub fn validate(&self) -> anyhow::Result<()> {
        use anyhow::ensure;
        let members = self
            .members
            .iter()
            .collect::<std::collections::HashSet<_>>();
        ensure!(
            members.len() == self.members.len(),
            "change {} repeats a member",
            self.id
        );
        match self.action {
            ChangeAction::Absence
            | ChangeAction::TentativeAbsence
            | ChangeAction::ActivityPause => {
                ensure!(
                    !self.members.is_empty(),
                    "change {} has no affected member",
                    self.id
                );
            }
            ChangeAction::Cancellation => {
                ensure!(
                    !self.before.is_empty(),
                    "cancellation {} has no original arrangement",
                    self.id
                );
            }
            ChangeAction::Reschedule
            | ChangeAction::ScheduleRevision
            | ChangeAction::LineupChange => {
                ensure!(
                    !self.before.is_empty() && !self.after.is_empty(),
                    "change {} needs original and revised arrangements",
                    self.id
                );
            }
            ChangeAction::TimeChange => {
                ensure!(
                    self.after
                        .iter()
                        .flat_map(|s| &s.events)
                        .any(|e| e.planned_time.is_some()),
                    "time change {} has no revised time",
                    self.id
                );
            }
            ChangeAction::FormatChange => {
                ensure!(
                    self.after.iter().flat_map(|s| &s.events).any(|e| e
                        .format_label
                        .as_ref()
                        .is_some_and(|label| !label.trim().is_empty())),
                    "format change {} has no revised format",
                    self.id
                );
            }
            ChangeAction::RoomChange => {
                ensure!(
                    self.after
                        .iter()
                        .flat_map(|s| &s.events)
                        .any(|e| e.room.is_some() || e.host_member.is_some()),
                    "room change {} has no revised room",
                    self.id
                );
            }
            ChangeAction::AdditionalStream => {
                ensure!(
                    !self.after.is_empty(),
                    "additional stream {} has no arrangement",
                    self.id
                );
            }
            ChangeAction::ScheduleAnnouncement | ChangeAction::Postponement => {}
        }
        for schedule in self.before.iter().chain(&self.after) {
            for event in &schedule.events {
                let members = event
                    .members
                    .iter()
                    .collect::<std::collections::HashSet<_>>();
                ensure!(
                    members.len() == event.members.len(),
                    "change {} arrangement repeats a member",
                    self.id
                );
                if let Some(count) = event.member_count {
                    ensure!(
                        usize::from(count.get()) >= event.members.len(),
                        "change {} has conflicting member count",
                        self.id
                    );
                }
            }
        }
        Ok(())
    }
    pub fn dates(&self) -> anyhow::Result<Vec<NaiveDate>> {
        use anyhow::{Context, ensure};
        let dates =
            match &self.impact {
                ChangeImpact::Dates { dates } => {
                    ensure!(!dates.is_empty(), "change {} has no impact dates", self.id);
                    let unique = dates.iter().collect::<std::collections::HashSet<_>>();
                    ensure!(
                        unique.len() == dates.len(),
                        "change {} repeats an impact date",
                        self.id
                    );
                    dates.clone()
                }
                ChangeImpact::Range { from, through } => {
                    ensure!(
                        from <= through,
                        "change {} has reversed impact range",
                        self.id
                    );
                    from.iter_days()
                        .take_while(|date| date <= through)
                        .collect()
                }
                ChangeImpact::Ongoing { from } => vec![*from],
                ChangeImpact::Undated => vec![self.announced_on.with_context(|| {
                    format!("undated change {} has no announcement date", self.id)
                })?],
            };
        Ok(dates)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, Default)]
#[serde(deny_unknown_fields)]
pub struct Dataset {
    pub events: Vec<Event>,
    pub works: Vec<Work>,
    pub performances: Vec<Performance>,
    pub recordings: Vec<Recording>,
    pub plans: Vec<Plan>,
    pub changes: Vec<Change>,
}
