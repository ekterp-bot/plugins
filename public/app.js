(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const menu = $('.menu-toggle');
  const nav = $('#main-nav');
  const closeMenu = () => {menu.setAttribute('aria-expanded','false');nav.classList.remove('is-open');};
  menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));nav.classList.toggle('is-open',open);});
  nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.getAttribute('aria-expanded')==='true'){const inMenu=nav.contains(document.activeElement);closeMenu();if(inMenu)menu.focus();}});
  window.matchMedia('(min-width:761px)').addEventListener('change',closeMenu);
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  let motionRequested=true;
  try{motionRequested=localStorage.getItem('hex-motion')!=='off';}catch{}
  function applyMotion(){const on=motionRequested&&!reduced.matches;document.body.classList.toggle('motion-off',!on);$('#motion-toggle')?.setAttribute('aria-pressed',String(on));if($('#motion-label'))$('#motion-label').textContent=reduced.matches?'Reduced motion':`Atmosphere ${on?'on':'off'}`;}
  $('#motion-toggle')?.addEventListener('click',()=>{motionRequested=!motionRequested;try{localStorage.setItem('hex-motion',motionRequested?'on':'off');}catch{}applyMotion();});
  reduced.addEventListener('change',applyMotion);applyMotion();
  document.addEventListener('visibilitychange',()=>document.body.classList.toggle('page-hidden',document.hidden));
  const dialog=$('#interface-dialog');
  $$('.product-image-button').forEach(button=>button.addEventListener('click',()=>dialog.showModal()));
  $('.dialog-close')?.addEventListener('click',()=>dialog.close());
  dialog?.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
  if($('.audio-console')){
    // Explicit layout preview: no media requested before approved assets and QA.
    $$('[data-example]').forEach(button=>button.addEventListener('click',()=>{const e=button.dataset;$$('[data-example]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));$('#example-category').textContent=e.category;$('#example-title').textContent=e.title;$('#listen-cue').textContent=e.cue;$('#demo-status').textContent='Interface preview only. No audio is connected; the waveform is illustrative.';}));
    $$('[data-side]').forEach(button=>button.addEventListener('click',()=>{const processed=button.dataset.side==='processed';$$('[data-side]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));$('#side-label').textContent=processed?'B / PROCESSED':'A / ORIGINAL';$('.audio-console').classList.toggle('processed',processed);$('#demo-status').textContent=`${processed?'Processed':'Original'} selected for layout preview. No audio is connected.`;}));
    $('#demo-play').addEventListener('click',()=>{$('#demo-status').textContent='Playback is unavailable until approved audio is added. This is an interactive layout preview only.';$('#demo-status').classList.add('is-notice');});
    const fragment=document.createDocumentFragment();
    for(let i=0;i<128;i++){const bar=document.createElement('i');bar.style.height=`${15+48*Math.abs(Math.sin(i*.125))*(.45+.55*Math.abs(Math.sin(i*.73)))}%`;fragment.appendChild(bar);}
    $('.wave-bars').appendChild(fragment);
  }
  $('#support-form')?.addEventListener('submit',event=>{
    event.preventDefault();
    // Avoid transmitting or storing personal information in this local preview.
    $('#support-status').textContent='The required fields are complete. This is a preview: your message was not sent or saved. Use the contact email if you need help now.';
    $('#support-status').classList.add('is-notice');
  });
  const previewSubmit=document.querySelector('#support-form button[type=submit]');
  if(previewSubmit)previewSubmit.disabled=false;
  if(location.pathname==='/'&&/^#\/?(contact|services|solutions|websites|saas|automations|rescue|process)$/.test(location.hash))location.replace(/contact/.test(location.hash)?'/support':'/about');
})();
