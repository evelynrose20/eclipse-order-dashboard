import React from 'react';

/* The Order's own eclipsed serpent-house device, used across every public
   and member-facing surface. It is not an official imperial state insignia. */
export default function OrderEmblem({className=''}) {
 return <svg className={className} viewBox="0 0 64 72" fill="none" aria-hidden="true" focusable="false">
  <path d="M32 2 59 15V49L32 69 5 49V15Z" stroke="currentColor" strokeWidth="2"/>
  <path d="M32 9 52 19V45L32 60 12 45V19Z" stroke="currentColor" strokeWidth=".8" opacity=".45"/>
  <path d="M41 20A17 17 0 1 0 45 43 16 16 0 0 1 41 20Z" fill="currentColor"/>
  <path d="m35 26 4 7 8 2-8 3-4 7-3-7-8-3 8-2Z" fill="#aa343c"/>
  <path d="M13 53 32 65 51 53" stroke="#aa343c" strokeWidth="2"/>
 </svg>;
}
