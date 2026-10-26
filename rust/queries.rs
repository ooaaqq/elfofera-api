use crate::{
    contract::*,
    data::{Archive, normalize},
    model::*,
    views::*,
};
use chrono::{Days, NaiveDate};

impl Archive {
    pub fn search_works(&self, q: SearchQuery) -> SearchResponse {
        let search = q.q.map(|s| normalize(&s));
        let artist = q.artist.map(|s| normalize(&s));
        let selected = self
            .sorted_works
            .iter()
            .copied()
            .filter(|i| {
                let (title, artists) = &self.search[*i];
                search
                    .as_ref()
                    .is_none_or(|s| title.contains(s) || artists.contains(s))
                    && artist.as_ref().is_none_or(|s| artists.contains(s))
            })
            .collect::<Vec<_>>();
        let items = selected
            .iter()
            .skip(q.offset)
            .take(q.limit)
            .map(|i| WorkView::from(&self.data.works[*i]))
            .collect::<Vec<_>>();
        SearchResponse {
            page: Page::new(selected.len(), q.limit, q.offset, items.len()),
            items,
        }
    }
    fn selected(
        &self,
        id: &str,
        from: Option<NaiveDate>,
        through: Option<NaiveDate>,
        member: Option<Member>,
    ) -> Vec<&Performance> {
        self.by_work
            .get(id)
            .into_iter()
            .flatten()
            .map(|i| &self.data.performances[*i])
            .filter(|p| {
                within(p.date, from, through)
                    && member.is_none_or(|m| p.credited_members.contains(&m))
            })
            .collect()
    }
    pub fn history(&self, id: &str, q: HistoryQuery) -> Option<HistoryResponse> {
        let work = WorkView::from(&self.data.works[*self.works.get(id)?]);
        let selected = self.selected(id, q.from, q.through, q.member);
        let items = selected
            .iter()
            .skip(q.offset)
            .take(q.limit)
            .map(|p| HistoryItem {
                performance: PerformanceView::from(*p),
                event: EventView::from(&self.data.events[self.events[&p.event_id]]),
            })
            .collect::<Vec<_>>();
        Some(HistoryResponse {
            work,
            page: Page::new(selected.len(), q.limit, q.offset, items.len()),
            items,
        })
    }
    pub fn statistics(&self, id: &str, q: StatisticsQuery) -> Option<StatisticsResponse> {
        let work = WorkView::from(&self.data.works[*self.works.get(id)?]);
        let selected = self.selected(id, q.from, q.through, None);
        let by_member = MEMBERS
            .into_iter()
            .map(|member| {
                let credited = selected
                    .iter()
                    .filter(|p| p.credited_members.contains(&member))
                    .collect::<Vec<_>>();
                let mut urls = Vec::new();
                for p in &credited {
                    for url in &p.source_urls {
                        if !urls.contains(url) && urls.len() < 3 {
                            urls.push(url.clone());
                        }
                    }
                }
                MemberCount {
                    member,
                    count: credited.len(),
                    source_urls: urls,
                }
            })
            .collect();
        Some(StatisticsResponse {
            work,
            range: Range {
                from: q.from,
                through: q.through,
            },
            counting_unit: CountingUnit::PerformanceRecord,
            completeness: Completeness::KnownRecords,
            total: selected.len(),
            uncredited: selected
                .iter()
                .filter(|p| p.credited_members.is_empty())
                .count(),
            by_member,
        })
    }
    pub fn timeline(&self, q: TimelineQuery) -> TimelineResponse {
        let included = q.include.split(',').map(str::to_owned).collect::<Vec<_>>();
        let want = |s: &str| included.iter().any(|v| v == s);
        let mut days = Vec::new();
        let count = (q.through - q.from).num_days();
        for offset in 0..=count {
            let Some(date) = q.from.checked_add_days(Days::new(offset as u64)) else {
                break;
            };
            let empty = crate::data::DayIndex::default();
            let index = self.by_date.get(&date).unwrap_or(&empty);
            let events = index
                .events
                .iter()
                .map(|i| &self.data.events[*i])
                .filter(|e| matches_member(e, q.member))
                .collect::<Vec<_>>();
            let event_ids = events.iter().map(|e| e.id.as_str()).collect::<Vec<_>>();
            let performances = if want("performances") {
                index
                    .performances
                    .iter()
                    .map(|i| &self.data.performances[*i])
                    .filter(|p| q.member.is_none_or(|m| p.credited_members.contains(&m)))
                    .map(|p| TimelinePerformance {
                        performance: PerformanceView::from(p),
                        work: WorkView::from(&self.data.works[self.works[&p.work_id]]),
                    })
                    .collect::<Vec<_>>()
            } else {
                vec![]
            };
            let plans = if want("plans") {
                index
                    .plans
                    .iter()
                    .map(|i| &self.data.plans[*i])
                    .map(|p| {
                        let events = p
                            .events
                            .iter()
                            .filter(|e| {
                                q.member.is_none_or(|m| {
                                    e.members.iter().any(|name| member_string(m) == *name)
                                })
                            })
                            .cloned()
                            .collect();
                        PlanView {
                            id: format!("plan_{}", p.date),
                            date: p.date,
                            rest_day: p.rest_day,
                            events,
                            non_stream_activities: p.non_stream_activities.clone(),
                            source_urls: p.source_urls.clone(),
                        }
                    })
                    .filter(|p| q.member.is_none() || !p.events.is_empty())
                    .collect()
            } else {
                vec![]
            };
            let recordings = if want("recordings") {
                index
                    .recordings
                    .iter()
                    .map(|i| &self.data.recordings[*i])
                    .filter_map(|r| {
                        let linked = self
                            .by_recording
                            .get(&r.bvid)
                            .into_iter()
                            .flatten()
                            .map(|i| self.data.events[*i].id.clone())
                            .collect::<Vec<_>>();
                        if q.member.is_some()
                            && !linked.iter().any(|id| event_ids.contains(&id.as_str()))
                        {
                            return None;
                        }
                        Some(RecordingView {
                            bvid: r.bvid.clone(),
                            date: r.title_session.date,
                            event_ids: linked,
                            title: r.title.clone(),
                            uploader_name: r.uploader.name.clone(),
                            url: format!("https://www.bilibili.com/video/{}", r.bvid),
                        })
                    })
                    .collect()
            } else {
                vec![]
            };
            let changes = if want("changes") {
                index
                    .changes
                    .iter()
                    .map(|i| (*i, &self.data.changes[*i]))
                    .filter_map(|(index, c)| {
                        let mut members = c.members.clone();
                        for name in c.member.iter().chain(
                            c.from
                                .iter()
                                .chain(c.to.iter())
                                .chain(c.replaces_plan.iter())
                                .flat_map(|s| s.members.iter().flatten()),
                        ) {
                            if !members.contains(name) {
                                members.push(name.clone());
                            }
                        }
                        if q.member
                            .is_some_and(|m| !members.contains(&member_string(m)))
                        {
                            return None;
                        }
                        Some(ChangeView {
                            id: format!("change_{index}_{date}"),
                            date,
                            action: c.action.clone(),
                            title: c.title.clone(),
                            members,
                            from: c.from.clone(),
                            to: c.to.clone(),
                            event_id: c.event_id.clone(),
                            source_urls: c.source_urls.clone(),
                        })
                    })
                    .collect()
            } else {
                vec![]
            };
            let top_performances = performances
                .iter()
                .filter(|p| {
                    !want("events") || !event_ids.contains(&p.performance.event_id.as_str())
                })
                .cloned()
                .collect();
            let events = if want("events") {
                events
                    .into_iter()
                    .map(|e| TimelineEvent {
                        event: EventView::from(e),
                        performances: performances
                            .iter()
                            .filter(|p| p.performance.event_id == e.id)
                            .cloned()
                            .collect(),
                    })
                    .collect()
            } else {
                vec![]
            };
            days.push(Day {
                date,
                events,
                performances: top_performances,
                plans,
                recordings,
                changes,
            });
        }
        TimelineResponse {
            range: Range {
                from: Some(q.from),
                through: Some(q.through),
            },
            time_zone: TimeZone::Shanghai,
            completeness: Completeness::KnownRecords,
            included,
            days,
        }
    }
}
fn within(date: NaiveDate, from: Option<NaiveDate>, through: Option<NaiveDate>) -> bool {
    from.is_none_or(|d| date >= d) && through.is_none_or(|d| date <= d)
}
fn matches_member(e: &Event, member: Option<Member>) -> bool {
    member.is_none_or(|m| {
        e.recording_named_members.contains(&m)
            || e.planned_members.contains(&m)
            || e.host_member == Some(m)
    })
}
fn member_string(m: Member) -> String {
    match m {
        Member::Luzao => "luzao",
        Member::Youen => "youen",
        Member::Yumo => "yumo",
        Member::Waner => "waner",
        Member::Minuo => "minuo",
    }
    .to_owned()
}
