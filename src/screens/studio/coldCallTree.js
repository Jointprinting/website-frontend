// src/screens/studio/coldCallTree.js
//
// The JP Webworks cold-call decision tree — DATA ONLY (50+ nodes: openers, pain
// digs, objection branches, closes, exits). Extracted from Studio.js so the
// shell component stays readable; the ColdCallTab renders it and layers the
// owner's per-line overrides (persisted via /api/jpw/cold-call-state) on top.
//
// Node shape:
//   { stage, script: [..paragraphs..], followUp?, voicemail?, direction?,
//     next: [{ label, to }], end?: 'success'|'warning'|'neutral', badge? }
// {{biz}} / {{svc}} / {{name}} placeholders are substituted live by the tab.

export const COLD_CALL_NODES = {
  // ─── ENTRY POINTS ──────────────────────────────────────────────────────
  start: {
    stage: 'Open the line',
    script: ["Hey, is this {{name}}?"],
    direction: "Using the owner's first name lands way better than 'is this the owner of {{biz}}?' — it sounds like you know them. Spend 30 seconds researching the name before you dial (Outscraper export, GBP, LinkedIn, Facebook). If you don't have a name, fall back to 'Hey, is this the owner of {{biz}}?' but make name lookup the default.",
    next: [
      { label: 'Yes — got the owner', to: 'opener' },
      { label: 'No / who is this? / gatekeeper', to: 'gatekeeper' },
      { label: 'Goes to voicemail', to: 'voicemail' },
      { label: 'Not a good time / hangs up', to: 'callback' },
    ],
  },

  gatekeeper: {
    stage: 'Gatekeeper',
    script: [
      "No problem — quick one. Is {{name}} around? We work with one {{svc}} company per area on the online side and I'm putting together a shortlist for South Jersey — {{biz}} came up. Wanted to chat with them directly before moving on.",
    ],
    direction: "Never pitch the gatekeeper — they have no authority and treating them like a buyer breaks rapport. The 'shortlist for South Jersey' frame works because it sounds like an opportunity, not a sales call. Gatekeepers transfer opportunities; they screen out sales calls. If they push back, get the best time + a direct number.",
    next: [
      { label: 'Transferring me to owner', to: 'opener' },
      { label: 'Owner not in — got callback time', to: 'callback' },
      { label: 'They want me to email', to: 'send_something' },
      { label: "Owner won't take cold calls", to: 'polite_exit' },
    ],
  },

  // ─── THE PATTERN-INTERRUPT OPENER ──────────────────────────────────────
  opener: {
    stage: 'Opener (selectivity hook)',
    script: [
      "Great — {{name}}, this is Nate with JP Webworks, I'm local out of Marlton.",
      "I'll make it quick. We work with {{svc}} companies on the online side — basically making sure when someone searches for {{svc}} in your area, you look like the obvious company to call.",
      "I'm reaching out because I only work with one {{svc}} company per area, and I'm looking for the right fit in South Jersey. {{biz}} looked like a good company, so I figured I'd call you before moving on.",
    ],
    followUp: ["Are you guys taking on new work right now?"],
    direction: "Tonality is everything. Slow down — calm, confident, selective. You're not pitching them; you're considering them for a slot. Pause after each line and let it land. 'Before moving on' is doing real work — it's soft scarcity without being pushy. The qualifier at the end is where the call really begins; their answer routes everything that follows.",
    next: [
      { label: '"Yeah, we could use more work"', to: 'pain_dig' },
      { label: '"We\'re slammed / pretty full"', to: 'slammed' },
      { label: '"Why us specifically?"', to: 'curiosity_hook' },
      { label: '"What do you do exactly?"', to: 'what_do_you_do' },
      { label: '"What kind of jobs?"', to: 'pain_dig' },
      { label: '"We have someone doing marketing"', to: 'have_a_guy' },
      { label: '"How much does this cost?"', to: 'price_early' },
      { label: '"I don\'t need a website"', to: 'dont_need' },
      { label: '"Just send me something"', to: 'send_something' },
      { label: 'Not interested', to: 'not_interested' },
    ],
  },

  // ─── DISCOVERY: SURFACE THE PAIN ───────────────────────────────────────
  pain_dig: {
    stage: 'Pain dig (NEPQ)',
    script: [
      "Got it. Quick question that helps me know if we're even a fit — what's the bottleneck for you guys? Is it not enough calls coming in, or you're getting calls but the wrong kind of jobs?",
    ],
    direction: "This is the killer question. The 'either/or' frame forces them to pick — both options surface useful info, and almost nobody answers 'neither' because both options sound plausible. Listen carefully, take notes, DON'T interrupt. Whoever talks first loses — sit in the silence even if it's 10 seconds long. Their answer is the entire pitch from here forward.",
    next: [
      { label: '"Not enough calls"', to: 'pain_few_calls' },
      { label: '"Calls but wrong kind / bad leads"', to: 'pain_wrong_leads' },
      { label: '"Both, honestly"', to: 'pain_both' },
      { label: '"We want bigger / higher-ticket jobs"', to: 'pain_wrong_leads' },
      { label: '"Things are actually fine"', to: 'no_pain_pivot' },
    ],
  },

  pain_few_calls: {
    stage: 'Pain → not enough calls',
    script: [
      "Yeah, that's the most common one. And here's what most {{svc}} owners don't realize — when someone in your area needs {{svc}}, they're picking who to call within 6 minutes of searching on their phone. They call whoever shows up first, has a real website, and looks legit. If you're not in that first batch, the phone just doesn't ring. And you never know it happened.",
      "Most {{svc}} guys I talk to are missing 3 to 5 jobs a month they can't see. The specific ones I can prove you're missing — that's what I was going to flag from your listing.",
    ],
    direction: "You just named a pain they feel (phantom slow weeks they can't explain) and tied the cause to something concrete (online visibility). Don't pitch a product — pitch the diagnosis. Bridge straight to the meeting ask.",
    next: [
      { label: 'Continue to the meeting ask', to: 'book_ask' },
    ],
  },

  pain_wrong_leads: {
    stage: 'Pain → wrong leads / wrong jobs',
    script: [
      "That's actually the harder problem to fix, but it's fixable. What's happening is your website and Google profile are attracting tire-kickers and discount-hunters instead of the real buyers. The good jobs — the bigger residential, the commercial, the insurance work — those people Google differently, and they're looking for different signals on a site before they call.",
      "So you've got two leaks: not enough volume of the right people, and what's coming in is the wrong shape. Both fixable, both come from the same place.",
    ],
    next: [
      { label: 'Continue to the meeting ask', to: 'book_ask' },
    ],
  },

  pain_both: {
    stage: 'Pain → both volume and quality',
    script: [
      "Yeah — those two are almost always linked. If you're showing up for the cheap commodity searches, you get the volume but it's all low-budget tire-kickers, and the higher-ticket buyers walk past because the site doesn't signal 'these guys can handle a $20K job.'",
      "Fixing both is the same project. Make the site convert the right buyer, and Google starts showing you to the right buyer. The phantom missed jobs disappear.",
    ],
    next: [
      { label: 'Continue to the meeting ask', to: 'book_ask' },
    ],
  },

  no_pain_pivot: {
    stage: 'They claim no pain',
    script: [
      "Got it — that's actually great to hear. Means whatever you're doing is working.",
      "One last question, then I'll let you go — are most of your jobs coming from referrals and repeat customers, or are you getting net-new people who Googled you and called?",
    ],
    direction: "Most 'things are fine' owners are 80%+ referral-based, which means they have ZERO visibility for net-new searchers. That's the hidden pain — they don't see it because referrals mask it. If they admit it's mostly referrals, you have your wedge into the conversation.",
    next: [
      { label: '"Mostly referrals"', to: 'referral_pivot' },
      { label: '"Pretty even mix"', to: 'pain_few_calls' },
      { label: '"Genuinely all set — not interested"', to: 'polite_exit' },
    ],
  },

  referral_pivot: {
    stage: 'Referral business → hidden leak',
    script: [
      "Cool — referrals are the best leads, no argument. Here's the catch most guys don't see: even when someone refers you, the first thing they do is Google {{biz}} to check you out. They get 6 seconds on your site before they decide if they're actually calling. If something's off — site looks dated, doesn't load on their phone, services aren't obvious — they bounce. And the referrer never finds out the referral didn't land.",
      "You're losing referrals you already earned. Probably not a ton — but every one was a free customer you should've had. That's the wedge.",
    ],
    next: [
      { label: 'Continue to the meeting ask', to: 'book_ask' },
    ],
  },

  slammed: {
    stage: '"We\'re slammed"',
    script: [
      "Got it — that's actually exactly what we look for. The companies we get the best results for are the ones already running well; we don't try to revive dead businesses, we amplify what's working.",
      "Quick question though — is it steady year-round, or do you have a slow season? Most {{svc}} guys I know go 80% capacity in summer, 40% in winter, something like that.",
    ],
    direction: "Don't back away just because they're busy — that's the cold-caller move. Slammed = good operator = ideal client. Reframe it as a feature. The seasonal pivot is the wedge: almost every service business has a slow window, and the work to fix it has to start NOW.",
    next: [
      { label: '"Yeah, it slows down in [season]"', to: 'seasonal_pain' },
      { label: '"Pretty steady all year"', to: 'higher_ticket_pivot' },
      { label: '"Actually all set, thanks"', to: 'polite_exit' },
    ],
  },

  seasonal_pain: {
    stage: 'Seasonal pain pivot',
    script: [
      "That's most {{svc}} guys. Here's the thing — building online visibility takes 60 to 90 days to actually kick in. So if you wait until your slow season hits to start fixing it, you're already 3 months behind. The guys who don't bleed cash in the slow months are the ones who set this up while they're still busy.",
      "I'd want to grab 15 minutes either way — not to pitch you anything, just to show you what I'd set up so when the slow season hits, you're not staring at empty trucks.",
    ],
    next: [
      { label: 'Continue to the meeting ask', to: 'book_ask' },
      { label: 'Still not interested', to: 'polite_exit' },
    ],
  },

  higher_ticket_pivot: {
    stage: 'Bigger jobs pivot',
    script: [
      "OK then I'd reframe it — it's not about MORE jobs, it's about BIGGER jobs. Same volume, higher average ticket. The bigger commercial and residential projects, the folks who don't haggle. Those buyers are Googling {{svc}} too — they're just looking for different signals on a site before they call. Most {{svc}} guys are losing those because the site looks like they only do small jobs.",
    ],
    next: [
      { label: 'Continue to the meeting ask', to: 'book_ask' },
      { label: '"Not interested, all set"', to: 'polite_exit' },
    ],
  },

  curiosity_hook: {
    stage: '"Why us?"',
    script: [
      "Fair question. Couple reasons — {{biz}} came up in my list of {{svc}} companies in your area, your operation looks legit, and from what I can tell you're not the biggest player in the area yet. The companies I get the best results for are the ones with real businesses underneath who just aren't fully represented online — that fits {{biz}}.",
      "The full answer is honestly a 15-minute screen-share where I pull up {{biz}} side by side with your top 3 competitors and walk you through exactly what I mean. Trying to describe it over the phone won't land — you really have to see it.",
    ],
    next: [
      { label: 'Continue to the meeting ask', to: 'book_ask' },
      { label: '"Just give me one specific thing"', to: 'one_specific' },
    ],
  },

  one_specific: {
    stage: 'One specific finding',
    script: [
      "Fair. One example — when I Googled '{{svc}} near me' from your area, you didn't show up on page one. The guys who did, half of them have worse reviews than you. That's the kind of thing that's fixable but you really have to see it side-by-side to make sense of it.",
    ],
    direction: "Adjust this specific based on what you actually found in your pre-call audit. If you didn't audit yet, use a generic but real observation — 'your phone number isn't tap-to-call on mobile' or 'your services page is two clicks deep' or 'no service area listed on your GBP' — these are almost always true.",
    next: [
      { label: 'Continue to the meeting ask', to: 'book_ask' },
    ],
  },

  // ─── OBJECTIONS ────────────────────────────────────────────────────────
  have_a_guy: {
    stage: '"We have a guy"',
    script: [
      "Cool — that actually makes my job easier. If your guy's nailing it, the 15 minutes confirms it and you've got an outside benchmark to hold him to. If something's getting missed, you'd want to know before a competitor takes the next job. Either way you win.",
      "Quick question, not a trick — what's he handling? Like, full picture? Website, Google profile, reviews, ads, all of it?",
    ],
    direction: "DON'T attack the guy. That's amateur hour and the owner will defend him reflexively. Validate the decision to hire someone, then ask what he's actually doing. Most 'have a guys' are doing 30% of what the owner thinks. That gap is where you live.",
    next: [
      { label: '"Just website" / "nephew built it"', to: 'gap_uncovered' },
      { label: '"Mostly ads" / "just one piece"', to: 'gap_uncovered' },
      { label: '"Honestly I don\'t know what he does"', to: 'gap_uncovered' },
      { label: '"He handles everything, I\'m good"', to: 'have_a_guy_firm' },
      { label: 'Not interested', to: 'not_interested' },
    ],
  },

  gap_uncovered: {
    stage: 'Gap in current coverage',
    script: [
      "Yeah, that's pretty typical actually. Most 'guys' are doing one piece — usually the website OR the Google profile OR ads. Rarely all three working together. And those pieces only work when they're stitched together right.",
      "Not a knock on him. But it means there's probably 60% of the picture he's not touching, and that's exactly where the missed jobs come from.",
    ],
    next: [
      { label: 'Continue to the meeting ask', to: 'book_ask' },
    ],
  },

  have_a_guy_firm: {
    stage: '"He handles everything" — firm',
    script: [
      "Fair. Last ask, then I'll let you go — 15 minutes, no strings. If your guy's got everything tight, you'll have an outside benchmark. If we spot something he missed, you can have a real conversation with him about it. Costs you nothing either way.",
    ],
    direction: "Don't push past TWO soft asks. Owners remember the call where you respected the no, and you can warm-follow-up in 90 days. Pushing past 2 = burned bridge. If they still say no, exit cleanly.",
    next: [
      { label: '"Alright, 15 minutes"', to: 'book_ask' },
      { label: 'Still no', to: 'polite_exit' },
    ],
  },

  price_early: {
    stage: 'Price asked early',
    script: [
      "Yeah, fair question. Honest answer — depends what's actually broken. Some guys need a Google profile cleanup, that's a couple hundred a month. Some need a full website rebuild — $749 setup, $299 a month after that. Some need ads, that sits on top.",
      "Quick number — what's an average {{svc}} job worth to you? Like a typical residential one?",
    ],
    direction: "DO NOT just quote prices and stop. Make THEM tell you their average ticket. This sets up the payback math from their own number, not yours — way more persuasive. If they refuse to give a number, go to price_general.",
    next: [
      { label: 'They gave me a number', to: 'payback_math' },
      { label: '"It varies / depends"', to: 'price_general' },
      { label: '"Too much regardless"', to: 'too_expensive' },
    ],
  },

  payback_math: {
    stage: 'Payback math',
    script: [
      "OK so let's say I'm right and we land you one extra {{svc}} job a month — people who would've called someone else. That's roughly 12 of those a year against $3,600 for the service. The math basically works on month one.",
      "Whole point of the 15-minute call is to see if I CAN land you one more a month. If I can't, it's not worth doing — and I'll tell you that.",
    ],
    direction: "Do the math out loud, slowly. If their ticket is $5K, one extra job = $60K/yr against $3,600 — that's a 16x ROI and the math sells itself. Let it land in silence.",
    next: [
      { label: 'Continue to the meeting ask', to: 'book_ask' },
      { label: '"Still too much"', to: 'too_expensive' },
    ],
  },

  price_general: {
    stage: 'Price — they won\'t give a number',
    script: [
      "All good. Roughly though — every {{svc}} owner I talk to says the same thing: even one extra job a month pays for the website for the year, easy. The real question isn't 'can I afford this,' it's 'is there a way to actually land more of those jobs.' That's what the 15 minutes is for.",
    ],
    next: [
      { label: 'Continue to the meeting ask', to: 'book_ask' },
      { label: '"Still not for me"', to: 'too_expensive' },
    ],
  },

  too_expensive: {
    stage: '"Too expensive"',
    script: [
      "Hear you. Quick reframe though — what's it costing you to NOT show up when someone searches {{svc}} in your zip? Most owners I talk to are missing 3-5 jobs a month they can't see. That's real money walking out the door every week, you just don't see it on your books because you never had it to begin with.",
      "The 15 minutes is free. Worst case I tell you there's nothing to fix and you saved yourself the money. But you'd want to know if there's a leak, right?",
    ],
    direction: "Reframe price to cost-of-inaction, not cost-of-action. Don't drop your price — drop their objection. Hormozi: every minute you don't fix it, it's costing more than fixing it would.",
    next: [
      { label: '"OK, 15 minutes"', to: 'book_ask' },
      { label: 'Hard no', to: 'not_interested' },
    ],
  },

  what_do_you_do: {
    stage: '"What do you do exactly?"',
    script: [
      "Three things, depending on the business — first, fix the website so it actually converts visitors into calls. Second, clean up the Google profile so you rank when people search {{svc}} in your area. Third, optionally run paid ads to fill capacity.",
      "Most clients we start with just the website because that's usually where the leak is. But I'd want to look at {{biz}} specifically before recommending anything — different businesses have different leaks.",
    ],
    next: [
      { label: '"Tell me more"', to: 'pain_dig' },
      { label: '"How much?"', to: 'price_early' },
      { label: '"We have someone"', to: 'have_a_guy' },
      { label: '"Just send info"', to: 'send_something' },
      { label: 'Not interested', to: 'not_interested' },
    ],
  },

  dont_need: {
    stage: '"Don\'t need a website"',
    script: [
      "I get it — plenty of {{svc}} guys built businesses without one. But here's what changed: when someone in your area needs {{svc}} today, the first thing they do is Google it. Phone in hand, in their driveway, deciding right then. No website, you don't show up. You don't exist to that customer.",
      "You're getting the customers who heard about you word-of-mouth. That's it. Every Google searcher walks past and calls the next guy. They don't even know to ask for you.",
    ],
    next: [
      { label: '"Hmm, fair point — keep going"', to: 'book_ask' },
      { label: '"Still don\'t care"', to: 'not_interested' },
    ],
  },

  what_is_audit: {
    stage: '"What\'s the call about?"',
    script: [
      "Simple — before our call I do what a customer does. I Google {{svc}} in your zip, screenshot the results. Where {{biz}} lands, what your site does on mobile, your Google profile, and what your top 3 competitors are doing differently. Then on a 15-minute screen-share I walk you through it.",
      "If I find nothing worth fixing, I tell you that and we go our separate ways. Most guys I do this for, there's at least 2-3 things that surprise them. The 15 minutes is free either way.",
    ],
    next: [
      { label: 'Continue to the meeting ask', to: 'book_ask' },
      { label: '"How much would the fix cost?"', to: 'price_early' },
    ],
  },

  send_something: {
    stage: '"Just send me info"',
    script: [
      "I could, but it'd be a generic brochure and you'd toss it. The reason this works is it's specific to {{biz}}.",
      "Quick one before I do anything — what kind of {{svc}} work are you most trying to grow? Bigger residential, commercial, a specific service?",
    ],
    direction: "If they answer, you just got the audit angle — pivot to send_close. If they shut down, send the Calendly link anyway — you'll have their cell for next-day follow-up.",
    next: [
      { label: 'They told me what they want', to: 'send_close' },
      { label: '"Don\'t care, just send something"', to: 'send_generic' },
      { label: 'Not interested', to: 'not_interested' },
    ],
  },

  send_close: {
    stage: 'Closing the soft ask',
    script: [
      "Perfect — I'll build the audit around exactly that. Way more useful than a generic pitch.",
      "What's the best cell to text the Calendly link to? You can grab whatever 15-minute slot works.",
    ],
    next: [
      { label: 'Got the cell', to: 'book_meeting' },
      { label: '"Just email instead"', to: 'send_generic' },
    ],
  },

  send_generic: {
    stage: 'Generic info / email send',
    script: [
      "All good. Best email or cell to send the Calendly link plus a quick overview of what we do?",
    ],
    direction: "Even when they shut down on the meeting, get a contact method. Next-day text with the Calendly link converts surprisingly often — they were just busy in the moment of the call.",
    next: [
      { label: 'Got cell or email', to: 'book_meeting' },
      { label: 'Refused to give contact', to: 'polite_exit' },
    ],
  },

  // ─── THE CLOSE ─────────────────────────────────────────────────────────
  book_ask: {
    stage: 'Book the meeting',
    script: [
      "Here's what I'd suggest — grab 15 minutes on the calendar this week or next. Before our call I do the full audit, then walk you through it live. You decide if any of it's worth fixing. No pitch, no surprise sales close at the end. Worst case you get 15 minutes of free intel on {{biz}}.",
    ],
    followUp: [
      "Would it be unreasonable to grab 15 minutes — Tuesday morning or Thursday afternoon, which is easier?",
    ],
    direction: "Two-option close beats open-ended 'what works for you' every time — it bypasses decision paralysis. 'Would it be unreasonable' (Josh Braun's move) is softer than 'would you' because it triggers a different yes-no calculation in their head. Adjust the two day-options based on your actual availability that week.",
    next: [
      { label: '"Tuesday morning works"', to: 'book_time_close' },
      { label: '"Thursday afternoon works"', to: 'book_time_close' },
      { label: '"Different day/time"', to: 'book_flexible' },
      { label: '"Just text me the link"', to: 'book_time_close' },
      { label: '"What exactly would we cover?"', to: 'what_is_audit' },
      { label: '"Send me info first"', to: 'send_close' },
      { label: 'Not interested', to: 'not_interested' },
    ],
  },

  book_flexible: {
    stage: 'They want a different time',
    script: [
      "No problem — what window works better for you? Mornings, afternoons, evenings? Earlier in the week or later?",
    ],
    direction: "Narrow with two-option questions until you have a specific time. Don't accept 'sometime next week' — keep narrowing. 'Tuesday or Wednesday?' 'Morning or afternoon?' 'Before or after lunch?' Vague = ghosted.",
    next: [
      { label: 'Got a specific time', to: 'book_time_close' },
      { label: 'Lost interest', to: 'not_interested' },
    ],
  },

  book_time_close: {
    stage: 'Confirm and close',
    script: [
      "Perfect. I'll text you my Calendly link in the next minute — grab that slot, you'll get a confirmation and a Google Meet link. What's the best cell to text it to?",
    ],
    next: [
      { label: 'Got the cell', to: 'book_meeting' },
      { label: 'Backed out', to: 'not_interested' },
    ],
  },

  // ─── EXITS ─────────────────────────────────────────────────────────────
  voicemail: {
    stage: 'Voicemail',
    end: 'warning',
    badge: 'Leave VM + send text within 2 min',
    script: ['Leave the voicemail below, then send the follow-up text within 2 minutes while your name is still in their recent calls log.'],
    voicemail: "Hey {{name}}, Nate from JP Webworks out of Marlton. We work with one {{svc}} company per area in South Jersey on the online side, and {{biz}} came up as a good fit when I was putting together my shortlist out there. Wanted to chat before I move on to someone else. Shoot me a text or callback when you get a sec — I'll text you my number too. Thanks.",
    direction: 'Cadence: leave a voicemail on attempts 1 and 4 ONLY (vary the message on 4). Attempts 2 and 3 — call and hang up if VM. After 5 untouched, move to 60-day backburner. Send the follow-up text within 2 minutes — "Hey {{name}}, Nate from JP Webworks — just left you a voicemail. Local out of Marlton. We only work with one {{svc}} company per area, {{biz}} is on my shortlist for South Jersey. No rush, text back when you can."',
  },

  callback: {
    stage: 'Callback scheduled',
    end: 'neutral',
    badge: 'Callback scheduled',
    script: ["No problem at all — when's a better time to catch you for two minutes?"],
    direction: "Get a SPECIFIC day AND time AND confirm the number. If they're vague ('next week'), narrow with two-option: 'Tuesday or Wednesday?' 'Morning or afternoon?' Vague callbacks = ghosted callbacks. Pin it down before hanging up.",
  },

  not_interested: {
    stage: 'Polite exit (cold)',
    end: 'neutral',
    badge: 'Closed — 90-day follow-up',
    script: [
      "All good — appreciate you taking the call.",
      "One quick last thing, no pressure — is it the timing, you've been burned by marketing before, or just not a fit right now? Helps me know whether to reach back out down the road.",
    ],
    direction: "This is the Columbo close — the most valuable line in the script. The no is already in; you're not flipping it, you're collecting intel for the 90-day follow-up. Owners will tell you things in this moment they wouldn't have told you 90 seconds ago. Log whatever they say verbatim. Then exit warmly.",
  },

  polite_exit: {
    stage: 'Polite exit (warm)',
    end: 'neutral',
    badge: 'Closed — 90-day follow-up',
    script: [
      "All good — I'll let you get back to it.",
      "I'll check back in a few months. Anything changes on your end before then, you've got my number. Have a good one, {{name}}.",
    ],
    direction: "Soft no's where the call stayed friendly. Log for 90-day follow-up. Using their name at goodbye is small but it lands — they remember the call as a real conversation, not a sales call.",
  },

  book_meeting: {
    stage: 'WIN',
    end: 'success',
    badge: 'Meeting booked',
    script: [
      "Perfect, {{name}}. Texting you the Calendly link right now — calendly.com/nate-jointprinting/30min. Grab whatever 15-minute slot works for you.",
      "I'll have the audit ready when we get on the call. Talk soon — appreciate you giving me the time today.",
    ],
    direction: "Action items the second you hang up — while it's hot: (1) TEXT the Calendly link within 60 seconds: 'Hey {{name}}, Nate from JP Webworks — booking link as promised: calendly.com/nate-jointprinting/30min. Looking forward to it.' (2) Log in CRM with full call notes — what they said about pain, ticket size, current marketing. (3) Schedule 30 min in your calendar the day before the meeting to build the audit (Google their service in their zip, screenshot results, check site on mobile, identify 3 specific competitor advantages, draft 2-3 fixes). (4) On the meeting itself: walk the audit FIRST. No pricing unless they ask twice. Goal of meeting #1 is getting them to ask 'OK what would it cost to fix this?' — then quote.",
  },
};
