export const brand = {
  name: 'Hex the Engineer',
  domain: 'hextheengineer.com',
  siteUrl: 'https://www.hextheengineer.com',
  tagline: 'Considered tools. Intentional sound.',
  mark: '/assets/hex-mark.svg',
  contact: 'hexsolutions.dev@gmail.com',
  // Leave commerce and all public installers disconnected until release approval.
  commerceEnabled: false,
};

export const products = [{
  id: 'nebula',
  slug: 'project-nebula',
  name: 'Project Nebula',
  wordmark: 'NEBULA',
  prefix: 'PROJECT',
  workingName: true,
  category: 'Intelligent mix finish',
  summary: 'Bring detail into focus. Soften the edges. Open the top end. Four focused controls for the final tonal decisions.',
  shortDescription: 'A considered finishing pass for mixing engineers.',
  status: 'Private beta',
  format: 'VST3',
  platform: 'Windows x64',
  testedSystem: 'Windows 11 Home 25H2 x64',
  hostQualification: 'Wider DAW and operating-system qualification is in progress.',
  version: 'Public release pending',
  assets: {
    interface: '/assets/plugin-interface.webp',
    small: '/assets/plugin-interface-small.webp',
    width: 2400,
    height: 1760,
    mark: '/assets/nebula-mark.svg',
  },
  captureLabel: 'Actual compiled development interface',
  offer: { price: null, currency: null, checkoutUrl: null, trialUrl: null, downloadUrl: null },
  controls: [
    { id:'clarity', name:'Clarity', label:'DETAIL / DEFINITION', headline:'Bring detail<br>into focus.', description:'Shape low-mid weight and presence for a more defined finish.', detail:'A focused way to adjust definition. Listen to the body of the mix as you bring detail forward.', color:'#75e3e8' },
    { id:'silk', name:'Silk', label:'SMOOTH / REFINE', headline:'Smooth the<br>broader edges.', description:'Refine upper-mid and treble harshness when the mix feels insistent.', detail:'Broader dynamic smoothing complements Tame’s narrower attention to prominent peaks.', color:'#c2a3f3' },
    { id:'air', name:'Air', label:'OPEN / ILLUMINATE', headline:'Give the top<br>end room.', description:'Lift existing high-frequency detail for a more open tonal balance.', detail:'Set openness by ear, checking cymbals, sibilance and the overall balance as you go.', color:'#82c8ff' },
    { id:'tame', name:'Tame', label:'CONTROL / BALANCE', headline:'Address what<br>stands out.', description:'Apply adaptive, narrow attenuation to prominent resonant peaks.', detail:'Delta Listen auditions what Tame removes. It does not represent the changes made by all four controls.', color:'#e8c681' },
  ],
  demos: [
    { id:'mix', name:'Full mix', category:'PREMASTER / FULL MIX', title:'The finishing pass', cue:'Listen for detail and smoother edges across an established mix.', original:null, processed:null },
    { id:'bus', name:'Instrument bus', category:'GROUP / INSTRUMENT BUS', title:'A shared tonal character', cue:'Listen for definition and a more considered balance across the group.', original:null, processed:null },
    { id:'vocal', name:'Vocal', category:'TRACK / VOCAL', title:'Detail with a softer edge', cue:'Listen for vocal definition and the balance of upper-mid and treble energy.', original:null, processed:null },
  ],
}];

export const productPath = product => `/plugins/${product.slug}`;
