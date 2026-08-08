// ===== CONTROLES DE UBICACIÓN Y VISTA =====
    // Propósito: Solicitar geolocalización únicamente por acción del usuario y alternar la vista de mapa.
    (function() {
      var locationButton = document.getElementById('location-btn');
      var locationResult = document.getElementById('location-result');
      locationButton.addEventListener('click', function() {
        locationResult.classList.remove('hidden');
        if (!navigator.geolocation) {
          locationResult.textContent = 'Su navegador no permite usar ubicación. Continúa seleccionado Arecibo.';
          return;
        }
        locationButton.disabled = true;
        locationButton.textContent = 'Solicitando permiso…';
        navigator.geolocation.getCurrentPosition(function() {
          locationResult.textContent = 'Ubicación recibida. Este piloto continúa mostrando Arecibo.';
          locationButton.textContent = 'Ubicación recibida';
        }, function() {
          locationResult.textContent = 'No se obtuvo permiso de ubicación. Continúa seleccionado Arecibo.';
          locationButton.disabled = false;
          locationButton.textContent = 'Usar mi ubicación';
        }, { enableHighAccuracy:false, timeout:8000, maximumAge:300000 });
      });

      var listButton = document.getElementById('list-view-btn');
      var mapButton = document.getElementById('map-view-btn');
      var list = document.getElementById('water-points-data');
      var map = document.getElementById('map-placeholder');
      mapButton.addEventListener('click', function() {
        list.classList.add('hidden'); map.classList.remove('hidden');
        mapButton.setAttribute('aria-pressed', 'true'); listButton.setAttribute('aria-pressed', 'false');
        mapButton.className = 'bg-[#0066CC] px-4 font-black text-white';
        listButton.className = 'bg-white px-4 font-black text-[#0057AD]';
      });
      listButton.addEventListener('click', function() {
        map.classList.add('hidden'); list.classList.remove('hidden');
        listButton.setAttribute('aria-pressed', 'true'); mapButton.setAttribute('aria-pressed', 'false');
        listButton.className = 'bg-[#0066CC] px-4 font-black text-white';
        mapButton.className = 'bg-white px-4 font-black text-[#0057AD]';
      });
    })();

(function() {
  var endpoint = document.querySelector('meta[name="sheet-data-url"]')?.content;
  if (!endpoint) return;
  var container = document.getElementById('sheet-data');
  var errorDiv = document.getElementById('menu-error');

  // ===== INTERPRETACIÓN Y PRESENTACIÓN DE FILAS =====
  // Propósito: Separar las filas por tipo, conservar la fuente y mostrar estados vacíos explícitos.
  function renderPayload(result, fromCache) {
    var rows = result.data || [];
    var norm = function(v) { return String(v || '').trim(); };
    var lower = function(v) { return norm(v).toLowerCase(); };
    var esc = function(v) {
      return norm(v).replace(/[&<>"']/g, function(c) {
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
      });
    };
    var field = function(row, keys) {
      for (var i=0; i<keys.length; i++) if (row[keys[i]] !== undefined && norm(row[keys[i]])) return row[keys[i]];
      return '';
    };
    var kind = function(row) {
      return lower(field(row, ['Tipo','tipo','Sección','Seccion','seccion','Section','section','Hoja','hoja','Categoria','Categoría','category']));
    };
    var select = function(words) {
      return rows.filter(function(row) {
        var value = kind(row);
        return words.some(function(word) { return value.indexOf(word) !== -1; });
      });
    };
    var chip = function(row) {
      var source = lower(field(row, ['Fuente','fuente','Source','source']));
      var confidence = lower(field(row, ['Confianza','confianza','Confirmado','confirmado','EstadoConfirmacion','Verificación','Verificacion']));
      var text = 'Información pendiente de confirmar';
      var classes = 'bg-[#FFF0D5] text-[#704000]';
      if (source.indexOf('aaa') !== -1 && confidence.indexOf('no') === -1) { text='Confirmado por AAA'; classes='bg-[#DDF5E5] text-[#0D662E]'; }
      else if ((source.indexOf('municip') !== -1 || confidence.indexOf('municip') !== -1) && confidence.indexOf('no') === -1) { text='Confirmado por municipio'; classes='bg-[#DDF5E5] text-[#0D662E]'; }
      else if (confidence.indexOf('autom') !== -1) { text='Actualizado automáticamente'; classes='bg-[#DDEEFF] text-[#004F9E]'; }
      else if (source.indexOf('comunit') !== -1 || confidence.indexOf('comunit') !== -1) { text='Reporte comunitario'; classes='bg-[#FFF0D5] text-[#704000]'; }
      return '<span class="chip '+classes+'">'+text+'</span>';
    };
    var card = function(row) {
      var imageKeys = ['Image URL','image_url','imageUrl','Image','image','Photo','photo','Picture','picture','Thumbnail','thumbnail','Logo','logo','Img','img','Avatar','avatar'];
      var imgUrl = '';
      for (var i = 0; i < imageKeys.length; i++) { if (row[imageKeys[i]]) { imgUrl = row[imageKeys[i]]; break; } }
      var name = field(row, ['Título','Titulo','title','Name','name','Lugar','lugar','Embalse','embalse','Día','Dia','dia']) || 'Información';
      var desc = field(row, ['Descripción','Descripcion','description','Description','Detalle','detalle','Mensaje','mensaje','Pronóstico','Pronostico','pronostico']);
      var address = field(row, ['Dirección','Direccion','direccion','Address','address']);
      var hours = field(row, ['Horario','horario','Hora','hora']);
      var updated = field(row, ['Actualizado','actualizado','Última actualización','Ultima actualizacion','last_updated','Fecha','fecha']);
      var imgHtml = imgUrl ? '<img src="' + esc(imgUrl) + '" alt="' + esc(name) + '" loading="lazy" style="width:100%;height:160px;object-fit:cover;display:block;border-radius:.55rem;margin-bottom:.75rem;" onerror="this.style.display=\'none\'">' : '';
      return '<article class="data-card">'+imgHtml+'<div class="flex flex-wrap justify-between gap-2"><h4>'+esc(name)+'</h4>'+chip(row)+'</div>'+
        (desc?'<p>'+esc(desc)+'</p>':'')+(address?'<p><strong>Dirección:</strong> '+esc(address)+'</p>':'')+
        (hours?'<p><strong>Horario:</strong> '+esc(hours)+'</p>':'')+(updated?'<p class="text-base text-slate-700"><strong>Actualizado:</strong> '+esc(updated)+'</p>':'')+'</article>';
    };
    var setList = function(id, list, emptyMessage) {
      document.getElementById(id).innerHTML = list.length ? list.map(card).join('') : '<div class="rounded-lg border-2 border-slate-300 bg-slate-50 p-4"><p class="font-bold">'+emptyMessage+'</p></div>';
    };

    var statusRows = select(['estado']);
    var status = statusRows[0] || {};
    var code = field(status, ['Código','Codigo','codigo','Code','code','Estado','estado']) || 'PENDIENTE';
    var title = field(status, ['Título','Titulo','titulo','Title','title']) || 'Información pendiente de confirmar';
    var description = field(status, ['Descripción','Descripcion','descripcion','Description','description']) || 'Todavía no hay un estado oficial verificado para Arecibo.';
    var source = field(status, ['Fuente','fuente','Source','source']) || 'Fuente oficial pendiente';
    var updated = field(status, ['Actualizado','actualizado','Última actualización','Ultima actualizacion','last_updated']) || 'Hora pendiente';
    var pending = lower(code).indexOf('pend') !== -1 || lower(field(status,['Confirmado','confirmado','Confianza','confianza'])).indexOf('pend') !== -1;
    var statusCard = document.getElementById('status-card');
    statusCard.classList.remove('status-pending','status-available','status-outage');
    statusCard.classList.add(pending ? 'status-pending' : (lower(code).indexOf('no') !== -1 || lower(code).indexOf('interrup') !== -1 ? 'status-outage' : 'status-available'));
    document.getElementById('status-heading').textContent = pending ? 'Información pendiente de confirmar' : title;
    document.getElementById('status-code').textContent = code;
    container.innerHTML = '<p class="leading-relaxed">'+esc(description)+'</p><div class="mt-4 flex flex-wrap gap-2">'+chip(status)+'</div>'+
      '<dl class="mt-4 grid gap-2 text-base sm:grid-cols-2"><div><dt class="font-black">Fuente</dt><dd>'+esc(source)+'</dd></div><div><dt class="font-black">Última actualización</dt><dd>'+esc(updated)+'</dd></div></dl>';
    container.setAttribute('aria-busy','false');

    setList('rationing-data', select(['racionamiento','racion']), 'No hay un horario de racionamiento verificado cargado.');
    setList('water-points-data', select(['puntosagua','punto agua','distribuci']), 'No hay puntos de distribución verificados cargados todavía. Consulte fuentes oficiales y llame antes de trasladarse.');
    setList('forecast-data', select(['pronostico','pronóstico','clima','lluvia']), 'No hay un pronóstico enlazado disponible en este momento. Consulte una fuente meteorológica oficial.');
    setList('reservoir-data', select(['embalse']), 'No hay niveles de embalses verificados cargados en este momento.');
    setList('alerts-data', select(['alerta']), 'No hay alertas verificadas cargadas en este momento.');

    var contacts = select(['contacto','ayuda']);
    var contactsEl = document.getElementById('contacts-data');
    if (!contacts.length) {
      contactsEl.innerHTML = '<div class="rounded-lg border-2 border-[#A15C00] bg-[#FFF4E5] p-4"><p class="font-black">Llame a AAA</p><p class="mt-1">Teléfono pendiente de verificación oficial</p></div>';
    } else {
      contactsEl.innerHTML = contacts.map(function(row) {
        var name = field(row,['Nombre','nombre','Name','name','Título','Titulo']) || 'Contacto oficial';
        var phone = field(row,['Teléfono','Telefono','telefono','Phone','phone']);
        return '<article class="data-card"><h4>'+esc(name)+'</h4><p class="font-bold">'+(phone ? '<a class="inline-flex mt-2 items-center rounded-lg bg-[#0066CC] px-5 text-white" href="tel:'+esc(phone.replace(/[^0-9+]/g,''))+'">Llamar: '+esc(phone)+'</a>' : 'Teléfono pendiente de verificación oficial')+'</p>'+chip(row)+'</article>';
      }).join('');
    }

    if (fromCache) document.getElementById('offline-notice').classList.remove('hidden');
  }

  fetch(endpoint)
    .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function(result) {
      if (!container || !result.data || result.data.length === 0) {
        if (errorDiv) errorDiv.classList.remove('hidden');
        renderPayload({data:[]}, false);
        return;
      }
      try { localStorage.setItem('agua-pr-sheet-cache', JSON.stringify({savedAt:Date.now(), payload:result})); } catch(e) {}
      renderPayload(result, false);
    })
    .catch(function(err) {
      console.error('Sheet data error:', err);
      if (errorDiv) errorDiv.classList.remove('hidden');
      var cached = null;
      try { cached = JSON.parse(localStorage.getItem('agua-pr-sheet-cache')); } catch(e) {}
      if (cached && cached.payload && cached.payload.data) renderPayload(cached.payload, true);
      else renderPayload({data:[]}, true);
    });

  // Muestra el aviso inmediatamente si el navegador informa que no hay conexión.
  if (!navigator.onLine) document.getElementById('offline-notice').classList.remove('hidden');
  window.addEventListener('offline', function() { document.getElementById('offline-notice').classList.remove('hidden'); });
})();