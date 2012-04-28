Template.playlistHeader.playlistName = function () {
  return !!player.currentPlaylist() ? player.currentPlaylist().name : '';
}

Template.playlist.viewClass = function () {
  return player.currentPlaylist() ? '' : 'hidden';
}

Template.playlistItems.items = function () {
  if (!player.currentPlaylist()) return [];
  Meteor.setTimeout(attachTypeAhead, 1); // FIXME: UGLY!
  return player.items(player.currentPlaylist());
}

Template.playlistItem.playPauseIconClass = function() {
  return player.isPlaying(this) ? 'icon-pause' : 'icon-play';
}

Template.playlistItem.needlePosition = function() {

  var progress = player.getProgress(this);
  if (progress == 0) return 0;
  
  if (player.isPlaying(this)) { 
    var ctx = Meteor.deps.Context.current;
    Meteor.setTimeout(function() {
      ctx.invalidate();
    }, 250);
  }

  var scrubberWidth = $('.playlistItem .container').width();
  return Math.floor(scrubberWidth * progress);
}

Template.playlistItem.events = {
  'click .container .clickArea': function(e) {
    e.preventDefault();

    var $container = $(e.target).parents('.container'),
        offsetLeft = $container.offset().left,
        relativeX = e.clientX - offsetLeft,
        progress = relativeX / $container.width(),
        id = getId(e.target);
    
    player.play(id, progress);
  },

  'click .playPauseIcon .clickArea': function(e) {
    e.preventDefault();

    var id = getId(e.target);
    if (player.isPlaying(id))
      player.pause(id);
    else
      player.play(id);
  },

  'mousedown .moveIcon .clickArea': function(e) {
    e.preventDefault();

    Session.set('dragOriginX', e.clientX);
    Session.set('dragOriginY', e.clientY);
    Session.set('draggedItemId', getId(e.target));

  }
}

$(document).mouseup(function(e) {
  var afterId = hoveredItemId();
  if (afterId)
    player.move(Session.get('draggedItemId'), afterId);

  Session.set('dragOriginX', null);
  Session.set('dragOriginY', null);
  Session.set('draggedItemId', null);
})

$(document).mousemove(function(e) {
  Session.set('mouseX', e.clientX);
  Session.set('mouseY', e.clientY);
});


Template.playlistItem.placeHolderClassBelow = function() {
  return (this._id == hoveredItemId())  ? 'placeholder' : 'hidden';
}

Template.playlistItem.offsetX = function() {
  if (this._id != Session.get('draggedItemId')) return 0;
  return getDelta(Session.get('mouseX'), Session.get('dragOriginX'))
}

Template.playlistItem.offsetY = function() {
  if (this._id != Session.get('draggedItemId')) return 0;
  return getDelta(Session.get('mouseY'), Session.get('dragOriginY'))
}

function hoveredItemId() {
  if (!Session.get('dragOriginX')) return null;
  var mx = Session.get('mouseX'),
      my = Session.get('mouseY'),
      hoveredId = null;

  // TODO: Needs some kind of cache.
  $('.playlistItem').not('#'+Session.get('draggedItemId')).each(function() {
    var offset = $(this).offset(),
        x1 = offset.left,
        y1 = offset.top,
        x2 = offset.left + $(this).width(),
        y2 = offset.top  + $(this).height(),
        isInsideBox = !(mx < x1 || x2 < mx || my < y1 || y2 < my);
    if(isInsideBox) {
      hoveredId = this.id;
      return;
    }
  })
  return hoveredId;
}

function getId(element) {
  return $(element).parents('.playlistItem').attr('id');
}

function getDelta(v1, v2) {
  if (v1 == null || v2 == null) return 0;
  return v1-v2;
}

function attachTypeAhead() {
  Meteor.flush();
  $('#playlistView .new').typeahead({

    property: 'name',
    
    source: function (typeahead, query) {
      var uri = "http://ws.spotify.com/search/1/track.json?q=" + query;
      Meteor.http.call("GET", uri, {}, function (error, result) {
        var data = JSON.parse(result.content);
        var simpleTracks = [];
        for (var i=0;i<data.tracks.length;i++) {
          var track = data.tracks[i];
          simpleTracks.push({
            name:   track.name + " (" + track.artists[0].name + ")",
            href:   track.href,
            duration: track.length*1000
          });
        }
        return typeahead.process(simpleTracks);
      });
    },

    onselect: function(track) {
      player.add(track.name, track.href, track.duration, player.currentPlaylist()._id);
      $('#playlistView .new').val('').focus();
    }
  });

}