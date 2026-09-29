const mockQuery = jest.fn();
jest.mock('../../src/config/db', () => ({
  pool: { query: (...args) => mockQuery(...args) },
}));

const { detectHotspots } = require('../../src/services/complaint/hotspot.service');

function complaint(id, category, lat, lng, priority = 'MEDIUM', hoursAgo = 1) {
  return {
    id,
    complaint_number: `CMP-${id}`,
    category,
    priority_level: priority,
    latitude: lat,
    longitude: lng,
    created_at: new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString(),
    status: 'ASSIGNED',
  };
}

describe('hotspot.service.detectHotspots', () => {
  afterEach(() => jest.clearAllMocks());

  test('returns no hotspots when nothing meets the minimum complaint count', async () => {
    mockQuery.mockResolvedValue([[complaint(1, 'POTHOLE', 19.076, 72.878), complaint(2, 'POTHOLE', 19.076, 72.878)]]);
    const hotspots = await detectHotspots({ minComplaints: 3 });
    expect(hotspots).toEqual([]);
  });

  test('clusters complaints of the same category within the radius', async () => {
    mockQuery.mockResolvedValue([[
      complaint(1, 'DRAINAGE', 19.0760, 72.8780),
      complaint(2, 'DRAINAGE', 19.0761, 72.8781),
      complaint(3, 'DRAINAGE', 19.0762, 72.8779),
    ]]);
    const hotspots = await detectHotspots({ minComplaints: 3, radiusMeters: 450 });
    expect(hotspots).toHaveLength(1);
    expect(hotspots[0].category).toBe('DRAINAGE');
    expect(hotspots[0].complaintCount).toBe(3);
  });

  test('does not merge complaints of different categories even at the same location', async () => {
    mockQuery.mockResolvedValue([[
      complaint(1, 'DRAINAGE', 19.076, 72.878),
      complaint(2, 'GARBAGE', 19.076, 72.878),
      complaint(3, 'DRAINAGE', 19.076, 72.878),
    ]]);
    const hotspots = await detectHotspots({ minComplaints: 2 });
    expect(hotspots.every((h) => h.complaintCount <= 2)).toBe(true);
    expect(hotspots.some((h) => h.category === 'GARBAGE')).toBe(false); // only 1 garbage complaint, below min
  });

  test('excludes complaints far outside the radius from the same cluster', async () => {
    mockQuery.mockResolvedValue([[
      complaint(1, 'POTHOLE', 19.0760, 72.8780),
      complaint(2, 'POTHOLE', 19.0761, 72.8781),
      complaint(3, 'POTHOLE', 19.2000, 72.9500), // far away
    ]]);
    const hotspots = await detectHotspots({ minComplaints: 2, radiusMeters: 450 });
    expect(hotspots).toHaveLength(1);
    expect(hotspots[0].complaintCount).toBe(2);
  });

  test('reports the dominant (highest) priority level within the cluster', async () => {
    mockQuery.mockResolvedValue([[
      complaint(1, 'POTHOLE', 19.076, 72.878, 'LOW'),
      complaint(2, 'POTHOLE', 19.0761, 72.8781, 'CRITICAL'),
      complaint(3, 'POTHOLE', 19.0762, 72.8779, 'MEDIUM'),
    ]]);
    const hotspots = await detectHotspots({ minComplaints: 3 });
    expect(hotspots[0].dominantPriority).toBe('CRITICAL');
  });
});
