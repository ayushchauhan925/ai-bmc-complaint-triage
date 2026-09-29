jest.mock('../../src/models/complaint.model', () => ({
  findNearby: jest.fn(),
}));
jest.mock('../../src/models/embedding.model', () => ({
  findByComplaintIds: jest.fn(),
}));

const complaintModel = require('../../src/models/complaint.model');
const embeddingModel = require('../../src/models/embedding.model');
const duplicateDetectionService = require('../../src/services/duplicate/duplicateDetection.service');

function unitVector(dims, hotIndex) {
  const v = new Array(dims).fill(0);
  v[hotIndex] = 1;
  return v;
}

describe('duplicateDetection.service.findRelatedComplaints', () => {
  afterEach(() => jest.clearAllMocks());

  test('returns empty array when no embedding is provided', async () => {
    const result = await duplicateDetectionService.findRelatedComplaints({
      complaintId: 1,
      description: 'test',
      latitude: 19.07,
      longitude: 72.87,
      embedding: null,
    });
    expect(result).toEqual([]);
  });

  test('matches a nearby, semantically identical, recent complaint', async () => {
    complaintModel.findNearby.mockResolvedValue([
      { id: 2, latitude: 19.0701, longitude: 72.8701, created_at: new Date().toISOString() },
    ]);
    embeddingModel.findByComplaintIds.mockResolvedValue([{ complaint_id: 2, embedding: unitVector(5, 0) }]);

    const result = await duplicateDetectionService.findRelatedComplaints({
      complaintId: 1,
      description: 'large pothole near school',
      latitude: 19.07,
      longitude: 72.87,
      embedding: unitVector(5, 0),
    });

    expect(result).toHaveLength(1);
    expect(result[0].complaint.id).toBe(2);
    expect(result[0].semanticScore).toBeCloseTo(1, 5);
  });

  test('excludes a candidate whose embedding is semantically dissimilar', async () => {
    complaintModel.findNearby.mockResolvedValue([
      { id: 3, latitude: 19.0701, longitude: 72.8701, created_at: new Date().toISOString() },
    ]);
    embeddingModel.findByComplaintIds.mockResolvedValue([{ complaint_id: 3, embedding: unitVector(5, 4) }]);

    const result = await duplicateDetectionService.findRelatedComplaints({
      complaintId: 1,
      description: 'large pothole near school',
      latitude: 19.07,
      longitude: 72.87,
      embedding: unitVector(5, 0),
    });

    expect(result).toHaveLength(0);
  });

  test('excludes a candidate outside the search radius even if semantically identical', async () => {
    complaintModel.findNearby.mockResolvedValue([]); // findNearby itself applies the geo prefilter
    embeddingModel.findByComplaintIds.mockResolvedValue([]);

    const result = await duplicateDetectionService.findRelatedComplaints({
      complaintId: 1,
      description: 'large pothole near school',
      latitude: 19.07,
      longitude: 72.87,
      embedding: unitVector(5, 0),
    });

    expect(result).toEqual([]);
  });
});
