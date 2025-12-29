import { beforeEach, describe, expect, it } from 'vitest';
import { useTimelineStore } from '../timeline';

describe('Timeline Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    useTimelineStore.setState({
      tracks: [],
      sources: [],
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      selectedClipIds: [],
      selectedTrackId: null,
      zoom: 100,
      scrollX: 0,
    });
  });

  describe('Track Management', () => {
    it('should add a video track', () => {
      const { addTrack } = useTimelineStore.getState();

      const trackId = addTrack('video', 'Video 1');

      const { tracks } = useTimelineStore.getState();
      expect(tracks).toHaveLength(1);
      expect(tracks[0].id).toBe(trackId);
      expect(tracks[0].type).toBe('video');
      expect(tracks[0].name).toBe('Video 1');
      expect(tracks[0].muted).toBe(false);
      expect(tracks[0].locked).toBe(false);
    });

    it('should add multiple tracks of different types', () => {
      const { addTrack } = useTimelineStore.getState();

      addTrack('video', 'Video 1');
      addTrack('audio', 'Audio 1');
      addTrack('text', 'Text 1');

      const { tracks } = useTimelineStore.getState();
      expect(tracks).toHaveLength(3);
      expect(tracks.map((t) => t.type)).toEqual(['video', 'audio', 'text']);
    });

    it('should remove a track', () => {
      const { addTrack, removeTrack } = useTimelineStore.getState();

      const trackId = addTrack('video', 'Video 1');
      addTrack('audio', 'Audio 1');

      removeTrack(trackId);

      const { tracks } = useTimelineStore.getState();
      expect(tracks).toHaveLength(1);
      expect(tracks[0].type).toBe('audio');
    });

    it('should toggle track mute', () => {
      const { addTrack, toggleTrackMute } = useTimelineStore.getState();

      const trackId = addTrack('video', 'Video 1');
      expect(useTimelineStore.getState().tracks[0].muted).toBe(false);

      toggleTrackMute(trackId);
      expect(useTimelineStore.getState().tracks[0].muted).toBe(true);

      toggleTrackMute(trackId);
      expect(useTimelineStore.getState().tracks[0].muted).toBe(false);
    });

    it('should toggle track lock', () => {
      const { addTrack, toggleTrackLock } = useTimelineStore.getState();

      const trackId = addTrack('video', 'Video 1');
      expect(useTimelineStore.getState().tracks[0].locked).toBe(false);

      toggleTrackLock(trackId);
      expect(useTimelineStore.getState().tracks[0].locked).toBe(true);
    });
  });

  describe('Clip Management', () => {
    it('should add a clip to a track', () => {
      const { addTrack, addClip } = useTimelineStore.getState();

      const trackId = addTrack('video', 'Video 1');
      const clipId = addClip({
        type: 'video',
        trackId,
        sourceId: 'source-1',
        startTime: 0,
        duration: 5,
        inPoint: 0,
        outPoint: 5,
      });

      const { tracks, duration } = useTimelineStore.getState();
      expect(tracks[0].clips).toHaveLength(1);
      expect(tracks[0].clips[0].id).toBe(clipId);
      expect(duration).toBe(5);
    });

    it('should update a clip', () => {
      const { addTrack, addClip, updateClip } = useTimelineStore.getState();

      const trackId = addTrack('video', 'Video 1');
      const clipId = addClip({
        type: 'video',
        trackId,
        sourceId: 'source-1',
        startTime: 0,
        duration: 5,
        inPoint: 0,
        outPoint: 5,
      });

      updateClip(clipId, { startTime: 2, duration: 3 });

      const { tracks } = useTimelineStore.getState();
      expect(tracks[0].clips[0].startTime).toBe(2);
      expect(tracks[0].clips[0].duration).toBe(3);
    });

    it('should remove a clip', () => {
      const { addTrack, addClip, removeClip } = useTimelineStore.getState();

      const trackId = addTrack('video', 'Video 1');
      const clipId = addClip({
        type: 'video',
        trackId,
        sourceId: 'source-1',
        startTime: 0,
        duration: 5,
        inPoint: 0,
        outPoint: 5,
      });

      removeClip(clipId);

      const { tracks } = useTimelineStore.getState();
      expect(tracks[0].clips).toHaveLength(0);
    });

    it('should split a clip at a given time', () => {
      const { addTrack, addClip, splitClip } = useTimelineStore.getState();

      const trackId = addTrack('video', 'Video 1');
      const clipId = addClip({
        type: 'video',
        trackId,
        sourceId: 'source-1',
        startTime: 0,
        duration: 10,
        inPoint: 0,
        outPoint: 10,
      });

      splitClip(clipId, 4);

      const { tracks } = useTimelineStore.getState();
      expect(tracks[0].clips).toHaveLength(2);

      const [clip1, clip2] = tracks[0].clips;
      expect(clip1.startTime).toBe(0);
      expect(clip1.duration).toBe(4);
      expect(clip2.startTime).toBe(4);
      expect(clip2.duration).toBe(6);
    });

    it('should not split clip if split time is outside clip bounds', () => {
      const { addTrack, addClip, splitClip } = useTimelineStore.getState();

      const trackId = addTrack('video', 'Video 1');
      const clipId = addClip({
        type: 'video',
        trackId,
        sourceId: 'source-1',
        startTime: 0,
        duration: 10,
        inPoint: 0,
        outPoint: 10,
      });

      splitClip(clipId, 15); // Outside clip bounds

      const { tracks } = useTimelineStore.getState();
      expect(tracks[0].clips).toHaveLength(1);
    });

    it('should move a clip to a different track', () => {
      const { addTrack, addClip, moveClip } = useTimelineStore.getState();

      const track1Id = addTrack('video', 'Video 1');
      const track2Id = addTrack('video', 'Video 2');

      const clipId = addClip({
        type: 'video',
        trackId: track1Id,
        sourceId: 'source-1',
        startTime: 0,
        duration: 5,
        inPoint: 0,
        outPoint: 5,
      });

      moveClip(clipId, track2Id, 2);

      const { tracks } = useTimelineStore.getState();
      expect(tracks[0].clips).toHaveLength(0);
      expect(tracks[1].clips).toHaveLength(1);
      expect(tracks[1].clips[0].startTime).toBe(2);
    });
  });

  describe('Playback State', () => {
    it('should set current time', () => {
      const { setCurrentTime } = useTimelineStore.getState();

      setCurrentTime(5.5);
      expect(useTimelineStore.getState().currentTime).toBe(5.5);
    });

    it('should not set negative current time', () => {
      const { setCurrentTime } = useTimelineStore.getState();

      setCurrentTime(-5);
      expect(useTimelineStore.getState().currentTime).toBe(0);
    });

    it('should toggle playing state', () => {
      const { setIsPlaying } = useTimelineStore.getState();

      expect(useTimelineStore.getState().isPlaying).toBe(false);

      setIsPlaying(true);
      expect(useTimelineStore.getState().isPlaying).toBe(true);

      setIsPlaying(false);
      expect(useTimelineStore.getState().isPlaying).toBe(false);
    });
  });

  describe('Selection', () => {
    it('should select a clip', () => {
      const { addTrack, addClip, selectClip } = useTimelineStore.getState();

      const trackId = addTrack('video', 'Video 1');
      const clipId = addClip({
        type: 'video',
        trackId,
        sourceId: 'source-1',
        startTime: 0,
        duration: 5,
        inPoint: 0,
        outPoint: 5,
      });

      selectClip(clipId);

      const { selectedClipIds } = useTimelineStore.getState();
      expect(selectedClipIds).toEqual([clipId]);
    });

    it('should multi-select clips', () => {
      const { addTrack, addClip, selectClip } = useTimelineStore.getState();

      const trackId = addTrack('video', 'Video 1');
      const clipId1 = addClip({
        type: 'video',
        trackId,
        sourceId: 'source-1',
        startTime: 0,
        duration: 5,
        inPoint: 0,
        outPoint: 5,
      });
      const clipId2 = addClip({
        type: 'video',
        trackId,
        sourceId: 'source-2',
        startTime: 5,
        duration: 5,
        inPoint: 0,
        outPoint: 5,
      });

      selectClip(clipId1);
      selectClip(clipId2, true);

      const { selectedClipIds } = useTimelineStore.getState();
      expect(selectedClipIds).toEqual([clipId1, clipId2]);
    });

    it('should deselect all', () => {
      const { addTrack, addClip, selectClip, deselectAll } = useTimelineStore.getState();

      const trackId = addTrack('video', 'Video 1');
      const clipId = addClip({
        type: 'video',
        trackId,
        sourceId: 'source-1',
        startTime: 0,
        duration: 5,
        inPoint: 0,
        outPoint: 5,
      });

      selectClip(clipId);
      deselectAll();

      const { selectedClipIds } = useTimelineStore.getState();
      expect(selectedClipIds).toEqual([]);
    });
  });

  describe('Zoom and Scroll', () => {
    it('should set zoom within bounds', () => {
      const { setZoom } = useTimelineStore.getState();

      setZoom(200);
      expect(useTimelineStore.getState().zoom).toBe(200);

      setZoom(5); // Below minimum
      expect(useTimelineStore.getState().zoom).toBe(10);

      setZoom(600); // Above maximum
      expect(useTimelineStore.getState().zoom).toBe(500);
    });

    it('should set scroll position', () => {
      const { setScrollX } = useTimelineStore.getState();

      setScrollX(100);
      expect(useTimelineStore.getState().scrollX).toBe(100);

      setScrollX(-50); // Negative should be clamped to 0
      expect(useTimelineStore.getState().scrollX).toBe(0);
    });
  });

  describe('Source Management', () => {
    it('should add and remove sources', () => {
      const { addSource, removeSource } = useTimelineStore.getState();

      const sourceId = addSource({
        name: 'video.mp4',
        type: 'video',
        duration: 30,
        width: 1920,
        height: 1080,
      });

      expect(useTimelineStore.getState().sources).toHaveLength(1);
      expect(useTimelineStore.getState().sources[0].name).toBe('video.mp4');

      removeSource(sourceId);
      expect(useTimelineStore.getState().sources).toHaveLength(0);
    });

    it('should remove clips when source is removed', () => {
      const { addTrack, addClip, addSource, removeSource } = useTimelineStore.getState();

      const sourceId = addSource({
        name: 'video.mp4',
        type: 'video',
        duration: 30,
      });

      const trackId = addTrack('video', 'Video 1');
      addClip({
        type: 'video',
        trackId,
        sourceId,
        startTime: 0,
        duration: 5,
        inPoint: 0,
        outPoint: 5,
      });

      expect(useTimelineStore.getState().tracks[0].clips).toHaveLength(1);

      removeSource(sourceId);
      expect(useTimelineStore.getState().tracks[0].clips).toHaveLength(0);
    });
  });
});
