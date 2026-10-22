#!/usr/bin/env node
/*
  Compliance changes requested by CareVest on October 21, 2026 (Danson Nguyen, "Changes to the site"):
  remove references to CareVest Private Capital and to "our team of Dealing Representatives", keep the
  exempt-market education, never mention the third-party dealer, and the specific home / Core Fund /
  contact edits. Applied the same way to site/content/content.json (seed) and to the dashboard drafts.

  Usage:  node scripts/changes-2026-10-compliance.mjs            (rewrites content.json in place)
          import { mutate } from './changes-2026-10-compliance.mjs'   (apply to any content object)
*/
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const REP = 'A licensed Dealing Representative';

export function mutate(c) {
  const p = c.pages;
  const log = [];
  const set = (obj, key, value, label) => { if (obj && obj[key] !== value) { obj[key] = value; log.push(label || key); } };

  /* ---------------- Home ---------------- */
  const tb = p.index?.trustbar?.items?.find((i) => i.id === 'dealer');
  if (tb) { set(tb, 'label', 'Offering', 'home trust bar label'); set(tb, 'value', 'Offering available in Alberta and British Columbia', 'home trust bar value'); }
  set(p.index?.calculator, 'body', 'Move the slider to see estimated monthly income at the CareVest Core MIC historical compound annual yield, then get in touch with a licensed Dealing Representative.', 'home calculator intro');
  const hs = p.index?.how_it_works?.steps?.find((s) => s.id === 'talk');
  set(hs, 'body', `${REP} will work closely with you to understand your personal financial position to help you make an informed decision.`, 'home step 2');

  /* ---------------- Core Fund ---------------- */
  set(p['core-mic']?.hero?.primary_cta, 'label', 'Get in touch', 'core fund hero button');
  set(p['core-mic']?.resources, 'fine', '', 'core fund resources small text removed');

  /* ---------------- How Investing Works ---------------- */
  const h = p['how-investing-works'];
  if (h) {
    set(h._meta, 'description', 'The exempt market, suitability, and risks, explained in plain language by the CareVest Group.', 'how it works meta description');
    set(h.hero, 'sub', 'Investments in the CareVest Core MIC are offered through a licensed exempt market dealer, giving investors select opportunities in private issuers. We encourage our clients and prospects to ask questions.', 'how it works opening');
    set(h.dealer, 'eyebrow', 'About the exempt market', 'dealer section eyebrow');
    set(h.dealer, 'headline', 'Private offerings, made through a [[licensed dealer]].', 'dealer section headline');
    set(h.dealer, 'body_2', 'Investment opportunities in proprietary products are available to qualified individuals and corporate investors. Licensed Dealing Representatives, serving Alberta and British Columbia, work with you directly – explaining and reviewing, in detail, the private offerings available to determine a fit with your investment goals.', 'dealer body 2');
    set(h.dealer, 'body_3', 'The CareVest Group has been active in the prospectus-exempt market since 2005, with a focus on private real estate lending investments in Western Canada, including mortgage investment corporations (“MICs”). Offerings are made through a licensed exempt market dealer, which gives investors access to those proprietary products.', 'dealer body 3');
    const cards = h.dealer?.cards || [];
    set(cards.find((x) => x.id === 'approach'), 'body', 'The investment opportunities typically offered to qualified investors are in smaller, regional businesses operating in Western Canada.', 'dealer card approach');
    set(cards.find((x) => x.id === 'eligibility'), 'body', `${REP} will work with you to determine if a private investment is suitable for you.`, 'dealer card eligibility');
    set(cards.find((x) => x.id === 'education'), 'body', `Our educational resources cover everything from the basics of exempt market investing to advanced topics such as regulatory information and understanding risks. In addition to our resources, we provide personalized guidance and support to each of our clients. ${REP} will work closely with you to understand your personal financial position to help you make an informed decision about the investment opportunities available.`, 'dealer card education');
    const st = h.steps?.steps?.find((s) => s.id === 'talk');
    set(st, 'body', `${REP} will review available investment opportunities with you and explain the investment process, and assess whether a private investment is suitable for your needs and goals.`, 'how it works step 2');
    set(h.industry_links, 'fine', 'NOTE: The CareVest Group is not associated with or specifically endorsed or recommended by the CSA or its Members and although the information contained in their website is believed to be accurate, complete, and up to date when posted, the CSA or its Members cannot guarantee that it is or will remain accurate, complete or current.', 'industry links note');
    if (h.complaints && h.complaints._hidden !== true) { h.complaints._hidden = true; log.push('complaints section hidden (dealer-specific; needs new wording from compliance)'); }
    set(h.final_cta, 'body', `${REP} will review available investment opportunities with you and explain the investment process.`, 'how it works closing');
  }

  /* ---------------- Our History, Events, About, Contact ---------------- */
  set(p['our-history']?.cta, 'body', `We encourage our clients and prospects to ask questions. ${REP} will give you straight answers about the group, the fund, and the risks.`, 'history closing');
  set(p.events?.why_attend?.cards?.find((x) => x.id === 'people'), 'body', 'Speak directly with the CareVest team and licensed Dealing Representatives. No pressure, no obligation.', 'events why attend');
  const ent = p.about?.entities;
  if (ent && ent.cards?.some((x) => x.id === 'private-capital')) { ent.cards = ent.cards.filter((x) => x.id !== 'private-capital'); log.push('about: CareVest Private Capital entity card removed'); }
  set(p.contact?.form, 'consent', 'If you are an investor, by clicking ‘SUBMIT MESSAGE’ above, you are expressly consenting to receive email communications from CareVest Management Corp. You may unsubscribe at any time via the links in those emails, or by contacting investor@carevest.com. If you are a borrower, by clicking ‘SUBMIT MESSAGE’ above, you are expressly consenting to receive email communications from CareVest Capital Inc. You may unsubscribe at any time by contacting borrow@carevest.com.', 'contact consent note');
  set(p.contact?.details, 'ir_emails', 'investor@carevest.com', 'contact investor relations email');
  /* Contact form routing (new structure): where each kind of message is delivered. */
  if (p.contact?.form) {
    set(p.contact.form, 'route_new_investor', 'invest@carevest.com', 'contact routing: new investor');
    set(p.contact.form, 'route_borrower', 'dnguyen@carevest.com', 'contact routing: borrower');
    set(p.contact.form, 'route_general', 'investor@carevest.com', 'contact routing: general');
    set(p.contact.form, 'selection_label', 'Selection', 'contact form selection label');
    set(p.contact.form, 'error', 'Sorry, your message could not be sent. Please email investor@carevest.com and we will get back to you.', 'contact form error text');
  }

  /* ---------------- Collections ---------------- */
  const faqs = c.collections?.faqs || [];
  const faq = (id) => faqs.find((f) => f.id === id);
  set(faq('how-regulated'), 'answer', '<p>The securities commissions/regulatory authorities in each province and territory regulate the public and private capital markets in Canada through securities legislation, regulations, rules and national or multilateral instruments. Security law administration and enforcement is overseen by security regulators that have regulatory oversight of issuers of exempt products and market participants – dealers and dealing representatives.</p><p>Exempt market dealers are registered with the securities regulator of each province in which they operate, and each Dealing Representative is registered with the regulator of the province in which they reside. You can look up any dealer or Dealing Representative on the <a href="https://www.securities-administrators.ca/">Canadian Securities Administrators website</a>.</p><p>(NOTE: The CareVest Group is not associated with or specifically endorsed or recommended by the CSA or its Members and that although the information contained in their website is believed to be accurate, complete, and up to date when posted, the CSA or its Members cannot guarantee that it is or will remain accurate, complete or current).</p>', 'FAQ: how regulated');
  set(faq('what-is-emd'), 'answer', '<p>The term Exempt Market Dealer (usually shortened to “EMD”), defines a company registered with securities regulators to trade in or underwrite investment securities that have not been qualified by a prospectus; instead, the investments are exempt from the prospectus requirement. Often referred to as ‘private capital’, these investments are often not publicly traded like other stocks and securities.</p><p>In 2009, the Canadian Securities Administrator enacted National Instrument 31-103 Registration Requirements, Exemptions and Ongoing Registrant Obligations (“NI 31-103”), creating an investment dealer category called an Exempt Market Dealer (EMD), which would be allowed to trade in prospectus-exempt securities. Under NI 31-103, an EMD must be registered in the province or provinces where they perform dealing activities. Further, NI 31-103 set out fundamental obligations registrants must adhere to including know their investments (often shortened to KYP – Know Your Product), know their clients (KYC – Know Your Clients), suitability and maintain appropriate industry knowledge and proficiencies. These fundamental obligations of registrants include the activities of the EMD and the EMD’s Dealing Representatives. EMDs must also address complaints in a timely fashion and have sufficient insurance.</p><p>In addition, under the Securities Act, an EMD and its Dealing Representatives must deal fairly, honestly, and in good faith with their clients. It is important that investors ensure that both the firm and the Dealing Representative they work with regarding the purchase of private securities is appropriately registered. You can confirm a dealer’s and a Dealing Representative’s registration on the <a href="https://www.securities-administrators.ca/">Canadian Securities Administrators website</a>.</p><p>(NOTE: The CareVest Group is not associated with or specifically endorsed or recommended by the CSA or its Members and that although the information contained in their website is believed to be accurate, complete, and up to date when posted, the CSA or its Members cannot guarantee that it is or will remain accurate, complete or current)</p>', 'FAQ: what is an EMD');
  set(faq('who-can-invest'), 'answer', `<p>Many investors are eligible to invest in the private market or exempt market, provided an exempt market dealer determines it is suitable for your personal circumstances. In some circumstances investors have requirements for annual income, assets or annual investment limits to invest in the private market or exempt market, but that is not always the case. ${REP} is available to explain the requirements to you and assess whether you qualify to invest in the private market.</p><p>Please <a href="/contact">Contact Us</a> and a licensed Dealing Representative will be in touch soon.</p>`, 'FAQ: who can invest');
  const why = faq('why-invest');
  if (why) set(why, 'answer', why.answer.replace('Our team of Dealing Representatives is available to help you understand the investments', 'A licensed Dealing Representative is available to help you understand the investments'), 'FAQ: why invest');
  const risks = faq('what-are-the-risks');
  if (risks) {
    set(risks, 'answer', risks.answer
      .replace('which will be explained to you by our team of Dealing Representatives.', 'which will be explained to you by a licensed Dealing Representative.')
      .replace('CPC’s Dealing Representatives will review the risks for the investments with you', 'A licensed Dealing Representative will review the risks for the investments with you'), 'FAQ: risks');
  }
  set(faq('how-can-i-invest'), 'answer', `<p>Please <a href="/contact">Contact Us</a> and fill out our contact form to speak with a licensed Dealing Representative for further information on investing in the exempt market. ${REP} will review available investment opportunities with you and explain the investment process.</p>`, 'FAQ: how can I invest');

  const team = c.collections?.team || [];
  const mike = team.find((t) => t.id === 'mike-poettcker') || team.find((t) => /Poettcker/.test(t.name || ''));
  if (mike) set(mike, 'bio', mike.bio.replace('Mike serves as the Head of Operations for the CareVest Group as well as the Chief Compliance Officer of CareVest Private Capital.', 'Mike serves as the Head of Operations for the CareVest Group.'), 'team: Mike bio');
  const malini = team.find((t) => t.id === 'malini-mumick');
  if (malini) {
    set(malini, 'title', 'Vice President, Sales', 'team: Malini role');
    if (malini.photo) set(malini.photo, 'alt', 'Malini Mumick, Vice President, Sales', 'team: Malini photo description');
    set(malini, 'bio', malini.bio.replace('Malini Mumick is the Vice President, Sales and a Dealing Representative with the group’s exempt market dealer, CareVest Private Capital, in the Vancouver office.', 'Malini Mumick is the Vice President, Sales for the CareVest Group in the Vancouver office.'), 'team: Malini bio');
  }
  const tl = (c.collections?.timeline || []).find((t) => t.id === '2005');
  if (tl) {
    set(tl, 'heading', 'The exempt market', 'timeline 2005 heading');
    set(tl, 'body', 'The group becomes active in the prospectus-exempt market, with a focus on private real estate lending investments in Western Canada, including mortgage investment corporations. Offerings are made through a licensed exempt market dealer, giving investors access to the group’s proprietary products.', 'timeline 2005 body');
  }

  /* ---------------- Site-wide ---------------- */
  if (c.globals?.disclaimer) {
    set(c.globals, 'disclaimer', c.globals.disclaimer
      .replace('Investment opportunities available through CareVest Private Capital Inc., an exempt market dealer registered in Alberta and British Columbia, are only suitable for investors', 'Investment opportunities offered through a registered exempt market dealer in Alberta and British Columbia are only suitable for investors')
      .replace(' Vancouver office is shared by CareVest Capital Inc. and CareVest Private Capital Inc. CareVest Management Corp. does not have an office in Vancouver.', ' CareVest Management Corp. does not have an office in Vancouver.'), 'site-wide disclaimer');
  }
  return log;
}

/* Run directly: rewrite the seed file. */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'content', 'content.json');
  const content = JSON.parse(readFileSync(file, 'utf8'));
  const log = mutate(content);
  writeFileSync(file, JSON.stringify(content, null, 2) + '\n');
  console.log(`${log.length} changes applied to content.json:`);
  for (const l of log) console.log(`  - ${l}`);
}
