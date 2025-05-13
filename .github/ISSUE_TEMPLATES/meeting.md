## Date/Time

| Timezone | Date/Time |
|----------|-----------|
<%= [
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'Europe/London',
  'Europe/Amsterdam',
  'Europe/Moscow',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney'
].map((zone) => {
  return `| ${zone} | ${date.setZone(zone).toFormat('EEE dd-MMM-yyyy HH:mm (hh:mm a)')} |`
}).join('\n') %>

Or in your local time:
* https://www.timeanddate.com/worldclock/?iso=<%= date.toFormat("yyyy-MM-dd'T'HH:mm:ss") %>

## Links

* Minutes Google Doc:

## Agenda

Extracted from **<%= agendaLabel %>** labelled issues and pull requests from **<%= owner %>/<%= repo %>** prior to the meeting.


<%= agendaIssues.map((i) => {
  return `* ${i.html_url}`
}).join('\n') %>

## Invited

- Performance working group team: @expressjs/perf-wg

### Observers/Guests

This meeting is open for anyone who wants to attend. Reminder to follow our [Code of Conduct](https://github.com/expressjs/express/blob/master/Code-Of-Conduct.md).

### Joining the meeting

* link for participants: https://zoom-lfx.platform.linuxfoundation.org/meeting/93099394904?password=d712f2e5-4fc9-45d1-99c5-fd762b885588
* For those who just want to watch: https://www.youtube.com/@expressjs-official

---

Please use the following emoji reactions in this post to indicate your
availability.

- 👍 - Attending
- 👎 - Not attending
- 😕 - Not sure yet

