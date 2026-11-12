use chrono::NaiveDate;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, JsonSchema)]
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

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Asset {
    #[schemars(regex(pattern = r"^BV[0-9A-Za-z]{10}$"))]
    pub bvid: Option<String>,
    pub part_numbers: Option<Vec<std::num::NonZeroU32>>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Guest {
    pub account_id: std::num::NonZeroU64,
    pub name: String,
    pub url: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Stage {
    pub title: String,
    pub dimension: String,
    pub title_hours: Vec<u8>,
    pub recording_bvids: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Event {
    #[schemars(length(min = 1))]
    pub id: String,
    pub date: NaiveDate,
    pub end_date: Option<NaiveDate>,
    #[schemars(length(min = 1))]
    pub title: String,
    #[schemars(length(min = 1))]
    pub kind: String,
    #[schemars(length(min = 1))]
    pub occurrence: String,
    #[serde(default)]
    pub recording_named_members: Vec<Member>,
    #[serde(default)]
    pub planned_members: Vec<Member>,
    #[serde(default)]
    pub credited_members: Vec<Member>,
    pub host_member: Option<Member>,
    #[serde(default)]
    pub related_works: Vec<String>,
    #[serde(default)]
    pub recordings: Vec<Asset>,
    #[serde(default)]
    pub assets: Vec<Asset>,
    #[schemars(regex(pattern = r"^BV[0-9A-Za-z]{10}$"))]
    pub preferred_recording_bvid: Option<String>,
    pub content_type: Option<String>,
    pub dimension: Option<String>,
    pub series: Option<String>,
    pub is_unannounced: Option<bool>,
    #[serde(default)]
    pub guests: Vec<Guest>,
    #[serde(default)]
    pub stages: Vec<Stage>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
    #[serde(skip)]
    #[schemars(skip)]
    pub source_urls: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Work {
    #[schemars(length(min = 1))]
    pub id: String,
    #[schemars(length(min = 1))]
    pub title: String,
    #[serde(default)]
    pub original_artists: Vec<String>,
    pub kind: Option<String>,
    pub series: Option<String>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
    #[serde(skip)]
    #[schemars(skip)]
    pub source_urls: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Performance {
    #[schemars(length(min = 1))]
    pub id: String,
    pub date: NaiveDate,
    #[schemars(length(min = 1))]
    pub event_id: String,
    #[schemars(length(min = 1))]
    pub work_id: String,
    #[serde(rename = "type")]
    #[schemars(length(min = 1))]
    pub kind: String,
    #[serde(default)]
    pub credited_members: Vec<Member>,
    pub credited_group: Option<String>,
    pub assets: Vec<Asset>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
    #[serde(skip)]
    #[schemars(skip)]
    pub source_urls: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct TitleSession {
    pub date: NaiveDate,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Uploader {
    pub name: Option<String>,
    pub account_id: Option<std::num::NonZeroU64>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Recording {
    #[schemars(regex(pattern = r"^BV[0-9A-Za-z]{10}$"))]
    pub bvid: String,
    #[schemars(length(min = 1))]
    pub title: String,
    pub title_session: TitleSession,
    pub uploader: Uploader,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct PlanEvent {
    #[serde(default)]
    pub members: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub planned_time: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub format_label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub participation: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub host_member: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub room_id: Option<u64>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Plan {
    pub date: NaiveDate,
    pub rest_day: Option<bool>,
    #[serde(default)]
    pub events: Vec<PlanEvent>,
    #[serde(default)]
    pub non_stream_activities: Vec<String>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
    #[serde(skip)]
    #[schemars(skip)]
    pub source_urls: Vec<String>,
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
    pub related_plan_dates: Vec<NaiveDate>,
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
pub struct Dataset {
    pub events: Vec<Event>,
    pub works: Vec<Work>,
    pub performances: Vec<Performance>,
    pub recordings: Vec<Recording>,
    pub plans: Vec<Plan>,
    pub changes: Vec<Change>,
}
