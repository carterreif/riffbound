// Build public playable copies from the owner's selected reviewed backups.
// Usage: node tools/build-public-demos.cjs FRANTIC.riffpack IN_BLOOM.riffpack ROAM.riffpack
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const L=require('../dist/song-library.js'),Updates=require('../dist/reference-updates.js');
const specs=[{slug:'frantic-drums-v2',title:'Frantic — Drums',artist:'Metallica'}, {slug:'in-bloom-drums-v4',title:'In Bloom — Drums',artist:'Nirvana'}, {slug:'roam-drums-v3',title:'Roam — Drums',artist:'Metallica'}];
const sources=process.argv.slice(2);if(sources.length!==3)throw Error('Supply the three reviewed full-song backups in Frantic, In Bloom, Roam order.');
const destination=path.resolve(__dirname,'../dist/demos'),temporary=fs.mkdtempSync(path.join(os.tmpdir(),'riffbound-demo-'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 fs.mkdirSync(destination,{recursive:true});const catalog=[];
 for(let i=0;i<specs.length;i++){
  const spec=specs[i],source=Updates.upgrade(await L.unpack(new Blob([fs.readFileSync(sources[i])]))),original=Buffer.from(await source.audioBlob.arrayBuffer());
  assert.equal(hash(original),source.id,'The source backup must contain its complete original audio.');
  assert.ok(source.musicEnd>250,'Each public demo must be a full song, not the earlier video excerpt.');
  const wav=path.join(temporary,spec.slug+'.wav'),mp3=path.join(destination,spec.slug+'.mp3'),decoded=path.join(temporary,spec.slug+'-decoded.wav');fs.writeFileSync(wav,original);
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',wav,'-map_metadata','-1','-codec:a','libmp3lame','-b:a','192k','-write_xing','1',mp3]);
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',mp3,'-codec:a','pcm_s16le',decoded]);
  const probe=f=>JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration:stream=sample_rate,channels','-of','json',f],{encoding:'utf8'}));
  const before=probe(wav),after=probe(decoded);assert.ok(Math.abs(Number(before.format.duration)-Number(after.format.duration))<.005,'Compression must retain the complete timeline.');
  const bytes=fs.readFileSync(mp3),id=hash(bytes),filename=spec.slug+'.mp3',quality={...source.quality,publicDemo:{slug:spec.slug,sourceAudioId:source.id,artist:spec.artist,reviewed:true}};
  const record=L.validate({...source,id,title:spec.title,filename,mime:'audio/mpeg',byteLength:bytes.length,quality});
  record.mime='audio/mpeg';record.byteLength=bytes.length;fs.writeFileSync(path.join(destination,spec.slug+'.json'),JSON.stringify(record)+'\n');
  catalog.push({id,title:spec.title,artist:spec.artist,instrument:'drums',musicEnd:source.musicEnd,charts:{drums:{}},metadata:'demos/'+spec.slug+'.json',audio:'demos/'+filename,audioBytes:bytes.length,publicDemo:true});
  console.log(JSON.stringify({title:spec.title,id,sourceAudioId:source.id,musicEnd:source.musicEnd,decodedDuration:Number(after.format.duration),audioBytes:bytes.length,expert:record.charts.drums.expert.length}));
 }
 fs.writeFileSync(path.join(destination,'catalog.json'),JSON.stringify(catalog,null,2)+'\n');
 fs.writeFileSync(path.join(destination,'../demo-catalog.js'),'/* Published reviewed demos; personal uploads never enter this catalog. */\n(function(root){const catalog='+JSON.stringify(catalog)+';if(typeof module!=="undefined"&&module.exports)module.exports=catalog;else root.RiffDemoCatalog=catalog;})(typeof window!=="undefined"?window:globalThis);\n');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>fs.rmSync(temporary,{recursive:true,force:true}));
