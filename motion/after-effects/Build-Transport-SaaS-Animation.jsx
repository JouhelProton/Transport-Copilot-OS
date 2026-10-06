/*
  Transport SaaS / B2B product animation — native After Effects composition
  Run in After Effects with File > Scripts > Run Script File...
  All copy, interface cards, marks, shapes, and animation keyframes are native layers.
  Brand naming is deliberately provisional; the symbol is a concept mark, not a final logo.
*/
(function () {
  app.beginUndoGroup("Build Transport SaaS Animation");
  var W = 1920, H = 1080, FPS = 25, DUR = 24;
  var C = {
    ink: [0.075,0.105,0.16], navy:[0.055,0.09,0.15], navy2:[0.09,0.14,0.22],
    blue:[0.216,0.459,0.91], blueLight:[0.48,0.66,1], mint:[0.10,0.63,0.49],
    mintLight:[0.72,0.95,0.84], white:[0.98,0.99,1], paper:[0.95,0.97,0.99],
    muted:[0.48,0.54,0.63], line:[0.87,0.90,0.94], amber:[0.88,0.62,0.20]
  };
  var project = app.project || app.newProject();
  var comp = project.items.addComp("BNB — Transport operations | Editable product film", W, H, 1, DUR, FPS);
  comp.bgColor = C.navy;
  function ease(prop) {
    for (var k=1; k<=prop.numKeys; k++) {
      try {
        var v=prop.keyValue(k), dims=(v instanceof Array)?v.length:1, incoming=[], outgoing=[];
        for (var i=0;i<dims;i++) { incoming.push(new KeyframeEase(0,70)); outgoing.push(new KeyframeEase(0,70)); }
        prop.setTemporalEaseAtKey(k,incoming,outgoing);
      } catch(e) {}
    }
  }
  function animate(layer, start, end, dx, dy, sc) {
    var tr=layer.property("ADBE Transform Group"), op=tr.property("ADBE Opacity"), pos=tr.property("ADBE Position"), scale=tr.property("ADBE Scale");
    var p=pos.value, s=scale.value, offset=[dx||0,dy||24];
    op.setValueAtTime(Math.max(0,start-0.28),0); op.setValueAtTime(start,100);
    op.setValueAtTime(Math.max(start,end-0.28),100); op.setValueAtTime(end,0);
    pos.setValueAtTime(Math.max(0,start-0.28),[p[0]+offset[0],p[1]+offset[1]]); pos.setValueAtTime(start,p);
    if (sc) { scale.setValueAtTime(Math.max(0,start-0.3),[s[0]*0.94,s[1]*0.94]); scale.setValueAtTime(start,s); }
    ease(op); ease(pos); if(sc) ease(scale);
    layer.inPoint=0; layer.outPoint=DUR;
  }
  function text(name, value, x, y, size, color, start, end, opts) {
    opts=opts||{}; var l=comp.layers.addText(value); l.name=name;
    var d=l.property("ADBE Text Properties").property("ADBE Text Document").value;
    d.font=opts.font||"Arial"; d.fontSize=size; d.fillColor=color; d.applyFill=true; d.applyStroke=false;
    d.justification=opts.align||ParagraphJustification.LEFT_JUSTIFY;
    if(opts.tracking) d.tracking=opts.tracking;
    l.property("ADBE Text Properties").property("ADBE Text Document").setValue(d);
    l.property("ADBE Transform Group").property("ADBE Position").setValue([x,y]);
    animate(l,start,end,0,opts.dy||24,opts.scale!==false); return l;
  }
  function rect(name,x,y,w,h,color,r,start,end,strokeColor,strokeWidth) {
    var l=comp.layers.addShape(); l.name=name;
    var root=l.property("ADBE Root Vectors Group"), g=root.addProperty("ADBE Vector Group"); g.name=name+" · vector";
    var v=g.property("ADBE Vectors Group"), rp=v.addProperty("ADBE Vector Shape - Rect");
    rp.property("ADBE Vector Rect Size").setValue([w,h]); rp.property("ADBE Vector Rect Roundness").setValue(r||0);
    if(color) { var f=v.addProperty("ADBE Vector Graphic - Fill"); f.property("ADBE Vector Fill Color").setValue(color); }
    if(strokeColor) { var st=v.addProperty("ADBE Vector Graphic - Stroke"); st.property("ADBE Vector Stroke Color").setValue(strokeColor); st.property("ADBE Vector Stroke Width").setValue(strokeWidth||2); }
    l.property("ADBE Transform Group").property("ADBE Position").setValue([x,y]); animate(l,start,end,0,22,true); return l;
  }
  function dot(name,x,y,r,color,start,end) {
    var l=comp.layers.addShape(); l.name=name; var g=l.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
    var v=g.property("ADBE Vectors Group"), e=v.addProperty("ADBE Vector Shape - Ellipse"); e.property("ADBE Vector Ellipse Size").setValue([r*2,r*2]);
    var f=v.addProperty("ADBE Vector Graphic - Fill"); f.property("ADBE Vector Fill Color").setValue(color);
    l.property("ADBE Transform Group").property("ADBE Position").setValue([x,y]); animate(l,start,end,0,12,true); return l;
  }
  function line(name,x1,y1,x2,y2,color,width,start,end) {
    var l=comp.layers.addShape(); l.name=name; var root=l.property("ADBE Root Vectors Group"), g=root.addProperty("ADBE Vector Group");
    var v=g.property("ADBE Vectors Group"), p=v.addProperty("ADBE Vector Shape - Group"), sh=new Shape();
    sh.vertices=[[x1,y1],[x2,y2]]; sh.inTangents=[[0,0],[0,0]]; sh.outTangents=[[0,0],[0,0]]; sh.closed=false; p.property("ADBE Vector Shape").setValue(sh);
    var s=v.addProperty("ADBE Vector Graphic - Stroke"); s.property("ADBE Vector Stroke Color").setValue(color); s.property("ADBE Vector Stroke Width").setValue(width); s.property("ADBE Vector Stroke Line Cap").setValue(2);
    l.property("ADBE Transform Group").property("ADBE Position").setValue([0,0]); animate(l,start,end,0,0,false); return l;
  }
  function label(kicker,title,sub,start,end) {
    text("SCENE · "+kicker,kicker.toUpperCase(),130,142,20,C.mintLight,start,end,{tracking:180});
    text("SCENE · Title",title,130,218,54,C.white,start+0.1,end,{dy:30});
    text("SCENE · Description",sub,130,270,23,[0.72,0.78,0.86],start+0.18,end,{dy:22});
  }
  function uiFrame(name,x,y,w,h,start,end,dark) {
    rect(name+" · panel",x+w/2,y+h/2,w,h,dark?C.navy2:C.white,22,start,end,dark?[0.18,0.24,0.33]:C.line,1.5);
    rect(name+" · topbar",x+w/2,y+42,w-2,82,dark?C.navy:C.paper,20,start,end);
    text(name+" · app name","BNB   /   OPERACIONES",x+28,y+49,15,dark?C.white:C.ink,start+0.15,end,{tracking:80});
    dot(name+" · status",x+w-40,y+42,6,C.mint,start+0.18,end);
  }
  function card(name,x,y,w,h,title,value,caption,start,end,accent) {
    rect(name+" · card",x+w/2,y+h/2,w,h,C.white,15,start,end,C.line,1);
    text(name+" · title",title,x+20,y+31,14,C.muted,start+0.1,end,{tracking:35});
    text(name+" · value",value,x+20,y+73,31,C.ink,start+0.14,end,{});
    if(caption) text(name+" · caption",caption,x+20,y+h-18,12,accent||C.muted,start+0.2,end,{});
  }
  function chip(name,value,x,y,w,start,end,fill,ink) {
    rect(name+" · chip",x+w/2,y+18,w,36,fill,18,start,end);
    text(name+" · text",value,x+14,y+24,13,ink,start+0.1,end,{});
  }

  // Dark, restrained system canvas with an editable route motif.
  rect("BG · deep ink",W/2,H/2,W,H,C.navy,0,0,DUR);
  rect("BG · left glow",320,570,500,500,[0.075,0.13,0.22],250,0,DUR);
  text("Project note · provisional concept","BRAND CONCEPT  /  TRANSPORT SaaS",130,68,14,[0.64,0.72,0.84],0,24,{tracking:115});

  // 01 — opening promise and three connected participants.
  text("01 · headline","Toda la operación.\nEn un solo flujo.",130,390,82,C.white,0.25,3.25,{dy:38});
  text("01 · subhead","Pedidos, equipos y entregas coordinados de principio a fin.",136,535,25,[0.72,0.78,0.86],0.48,3.25,{});
  chip("01 · role client","CLIENTE",145,665,155,0.7,3.1,C.navy2,C.white);
  chip("01 · role operator","OPERACIONES",372,665,190,0.85,3.1,C.navy2,C.white);
  chip("01 · role driver","CONDUCTOR",634,665,180,1,3.1,C.navy2,C.white);
  line("01 · connection A",300,701,370,701,C.blue,3,0.8,3.05); line("01 · connection B",562,701,632,701,C.mint,3,0.95,3.05);
  dot("01 · flow node",336,701,5,C.blueLight,0.85,3.05); dot("01 · automation node",596,701,5,C.mintLight,1,3.05);

  // 02 — order intake becomes a structured operation.
  label("02 / pedido","Del email a la operación.","La automatización extrae, valida y crea el servicio.",3.35,7.0);
  uiFrame("02 · inbox",860,352,850,510,3.55,6.9,false);
  chip("02 · source","PEDIDO RECIBIDO · PDF",900,466,265,3.8,6.6,[0.93,0.96,1],C.blue);
  card("02 · client","Cliente",900,530,240,130,"Mercadona Demo","Valencia → Madrid","CLI-78452",4.0,6.65);
  card("02 · load","Carga",1160,530,240,130,"18.500 kg","Alimentación","Carga completa",4.1,6.65);
  card("02 · assigned","Servicio",1420,530,250,130,"TR-10483","Creado y validado","Automático · 98 %",4.2,6.65,C.mint);
  text("02 · validation","✓  Cliente existente     ✓  Ruta válida     ✓  Datos completos",910,756,17,C.mint,4.35,6.65,{});
  chip("02 · label","PEDIDO",170,650,145,4.0,6.65,C.navy2,C.white);
  chip("02 · label service","SERVICIO",392,650,160,4.25,6.65,C.navy2,C.white);
  line("02 · flow",315,668,386,668,C.blueLight,3,4.1,6.5);

  // 03 — dispatch and live tracking.
  label("03 / control","Visibilidad para decidir.","Estado, responsable y ETA actualizados en tiempo real.",7.25,11.1);
  uiFrame("03 · dashboard",780,342,930,565,7.5,11.0,false);
  text("03 · dashboard title","Servicios activos",820,472,19,C.ink,7.8,10.9,{});
  card("03 · KPI 1","En ruta",820,505,190,116,"24","+6 hoy",7.9,10.85);
  card("03 · KPI 2","POD pendientes",1028,505,205,116,"03","2 requieren acción",8.0,10.85,C.amber);
  card("03 · KPI 3","Listos para facturar",1250,505,225,116,"18","Documentación OK",8.1,10.85,C.mint);
  rect("03 · tracking map",820,645,840,210,[0.93,0.96,0.98],14,8.05,10.85);
  line("03 · route segment 1",885,765,1080,700,C.blue,5,8.3,10.7); line("03 · route segment 2",1080,700,1300,750,C.blue,5,8.45,10.7); line("03 · route segment 3",1300,750,1550,690,C.blue,5,8.6,10.7);
  dot("03 · Valencia",885,765,8,C.mint,8.4,10.7); dot("03 · Madrid",1550,690,9,C.blue,8.65,10.7); dot("03 · live vehicle",1190,725,12,C.ink,8.7,10.7);
  text("03 · Valencia label","VALENCIA",850,816,12,C.muted,8.4,10.7,{tracking:55}); text("03 · Madrid label","MADRID · ETA 12:40",1435,650,12,C.muted,8.65,10.7,{tracking:35});
  chip("03 · service selected","TR-10483  ·  Mercadona Demo  ·  En ruta",164,684,445,7.9,10.75,C.navy2,C.white);

  // 04 — mobile driver action and digital proof of delivery.
  label("04 / entrega","La entrega cierra el ciclo.","El conductor comparte la confirmación y el POD.",11.35,15.0);
  rect("04 · phone shell",1325,335,330,620,[0.96,0.98,1],42,11.55,14.9,[0.7,0.76,0.84],2);
  rect("04 · phone screen",1325,347,302,594,C.white,32,11.65,14.85);
  text("04 · mobile top","BNB  /  CONDUCTOR",1195,425,14,C.ink,11.85,14.75,{tracking:75});
  chip("04 · on route","EN RUTA",1194,468,144,11.95,14.75,[0.90,0.96,0.93],C.mint);
  text("04 · destination","Mercadona Demo",1195,560,27,C.ink,12.1,14.75,{});
  text("04 · route","Valencia  →  Madrid",1195,602,18,C.muted,12.2,14.75,{});
  rect("04 · POD card",1325,700,245,105,C.paper,14,12.35,14.75);
  text("04 · POD title","Prueba de entrega",1214,688,14,C.muted,12.4,14.75,{});
  text("04 · POD state","POD recibido ✓",1214,742,22,C.mint,12.55,14.75,{});
  chip("04 · send","ENTREGA CONFIRMADA",1194,837,265,12.75,14.75,C.blue,C.white);
  line("04 · lifecycle 1",168,714,322,714,C.blueLight,3,12.2,14.7);
  chip("04 · status 1","ENTREGA",166,678,152,12.0,14.7,C.navy2,C.white);
  chip("04 · status 2","POD VALIDADO",378,678,190,12.3,14.7,C.navy2,C.white);
  chip("04 · status 3","FACTURABLE",628,678,180,12.6,14.7,C.navy2,C.white);

  // 05 — automation turns validated proof into a billable service.
  label("05 / automatización","Menos tareas. Más control.","Un POD validado prepara el servicio para facturación.",15.25,19.0);
  rect("05 · workflow card",815,390,830,390,C.white,20,15.5,18.9,C.line,1.5);
  text("05 · workflow heading","CONTROL DE FACTURACIÓN",865,458,15,C.muted,15.75,18.8,{tracking:95});
  chip("05 · trigger","1  ·  Entrega confirmada",865,505,330,15.95,18.8,[0.94,0.96,0.99],C.ink);
  chip("05 · check","2  ·  POD verificado",865,566,330,16.2,18.8,[0.90,0.96,0.93],C.mint);
  chip("05 · result","3  ·  Listo para facturar",865,627,350,16.45,18.8,[0.91,0.95,1],C.blue);
  text("05 · amount","1.250 €",1410,550,50,C.ink,16.3,18.75,{});
  text("05 · amount caption","TR-10483 · importe demo",1410,584,15,C.muted,16.45,18.75,{});
  text("05 · outcome","Operación documentada y lista para el siguiente paso.",855,840,20,[0.72,0.78,0.86],16.0,18.9,{});

  // 06 — final concept mark reveal: three parties + shared intelligence.
  rect("06 · closing field",W/2,H/2,W,H,C.navy,0,19.1,24);
  line("06 · connector left",725,530,860,530,C.blue,6,19.65,23.75);
  line("06 · connector right",1060,530,1195,530,C.mint,6,19.8,23.75);
  dot("06 · node left",700,530,14,C.blueLight,19.55,23.75);
  dot("06 · node center",960,530,40,C.white,19.75,23.75);
  dot("06 · inner signal",960,530,13,C.mint,19.9,23.75);
  dot("06 · node right",1220,530,14,C.mintLight,19.85,23.75);
  text("06 · closing title","Transporte conectado.\nOperación inteligente.",960,690,54,C.white,20.2,23.75,{align:ParagraphJustification.CENTER_JUSTIFY,dy:28});
  text("06 · concept label","SÍMBOLO CONCEPTUAL  ·  NOMBRE POR DEFINIR",960,818,15,[0.65,0.73,0.84],20.55,23.75,{align:ParagraphJustification.CENTER_JUSTIFY,tracking:95});
  text("06 · end slate","BNB  /  TRANSPORT SaaS",960,900,17,C.mintLight,20.8,23.85,{align:ParagraphJustification.CENTER_JUSTIFY,tracking:130});

  // Audio bed slot stays empty and named for easy replacement in AE.
  var marker = comp.markerProperty; try { marker.setValueAtTime(0,new MarkerValue("01 · Promesa")); marker.setValueAtTime(3.35,new MarkerValue("02 · Pedido")); marker.setValueAtTime(7.25,new MarkerValue("03 · Control y tracking")); marker.setValueAtTime(11.35,new MarkerValue("04 · Entrega y POD")); marker.setValueAtTime(15.25,new MarkerValue("05 · Automatización")); marker.setValueAtTime(19.1,new MarkerValue("06 · Logo conceptual")); } catch(e) {}
  app.endUndoGroup();
  alert("Composición creada: 1920×1080, 25 fps, 24 s. Capas nativas y keyframes editables. Guarda el proyecto .aep para conservarlo.");
})();
