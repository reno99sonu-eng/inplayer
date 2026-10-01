import {
  PutCommand,
  GetCommand,
  ScanCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { randomUUID } from "crypto";
import { isAdminEmail } from "@/app/lib/isAdmin";
import { getMuxThumbnailUrl } from "@/app/lib/muxThumbnail";


export const FILM_SERIES_TABLE = "InPlayer-Film-Series";
export const FILM_APPLICATIONS_TABLE = "InPlayer-Film-Creator-Applications";
export const FILM_SERIES_SUBSCRIPTIONS_TABLE = "InPlayer-Film-Series-Subscriptions";

export const FILM_GENRES = [
  "Drama", "Thriller", "Comedy", "Romance", "Horror",
  "Action", "Sci-Fi", "Mystery", "Fantasy", "Slice of Life",
  "Crime", "Family", "Historical", "Musical", "Devotional",
] as const;
export type FilmGenre = (typeof FILM_GENRES)[number];

export interface FilmSeries {
  seriesId: string;
  creatorId: string;
  creatorName: string;
  creatorAvatarUrl?: string;
  creatorHandle?: string;
  title: string;
  description: string;
  genre: FilmGenre;
  categories: string[];
  posterUrl: string;
  bannerUrl?: string;
  episodeCount: number;
  totalViews: number;
  totalLikes: number;
  subscriberCount: number;
  status: "draft" | "published" | "archived";
  visibility: "public" | "unlisted" | "private";
  audience: "everyone" | "kids" | "adult";
  language: string;
  releaseSchedule?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface FilmCreatorApplication {
  applicationId: string;
  userId: string;
  channelName: string;
  companyName?: string;
  personalName: string;
  username: string;
  phoneNumber: string;
  email: string;
  profilePicUrl?: string;
  bio?: string;
  portfolioLinks?: string[];
  socialLinks?: Record<string, string>;
  status: "pending" | "approved" | "rejected";
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  submittedAt: string;
  notifiedAt?: string;
}

export interface FilmEpisodeInput {
  seriesId: string;
  episodeNumber: number;
  seasonNumber: number;
  episodeTitle: string;
}

export async function getPublishedSeries(options?: { genre?: string; limit?: number; cursor?: string }): Promise<{ series: FilmSeries[]; nextCursor?: string }> {
  try {
    let filterExpression = "#status = :status";
    let expressionAttributeNames: Record<string, string> = {
      "#status": "status"
    };
    let expressionAttributeValues: Record<string, any> = {
      ":status": "published"
    };

    if (options?.genre) {
      filterExpression += " AND #genre = :genre";
      expressionAttributeNames["#genre"] = "genre";
      expressionAttributeValues[":genre"] = options.genre;
    }

    const command = new ScanCommand({
      TableName: FILM_SERIES_TABLE,
      FilterExpression: filterExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      Limit: options?.limit || 20,
      ExclusiveStartKey: options?.cursor ? JSON.parse(Buffer.from(options.cursor, 'base64').toString()) : undefined,
    });

    const response = await docClient.send(command);
    const nextCursor = response.LastEvaluatedKey ? Buffer.from(JSON.stringify(response.LastEvaluatedKey)).toString('base64') : undefined;

    return {
      series: (response.Items as FilmSeries[]) || [],
      nextCursor
    };
  } catch (error) {
    console.error("Error getting published series:", error);
    throw error;
  }
}

export async function getSeriesById(seriesId: string): Promise<FilmSeries | null> {
  try {
    const command = new GetCommand({
      TableName: FILM_SERIES_TABLE,
      Key: { seriesId }
    });
    const response = await docClient.send(command);
    return (response.Item as FilmSeries) || null;
  } catch (error) {
    console.error("Error getting series by id:", error);
    throw error;
  }
}

export async function getSeriesByCreator(creatorId: string): Promise<FilmSeries[]> {
  try {
    const command = new QueryCommand({
      TableName: FILM_SERIES_TABLE,
      IndexName: "creatorId-index",
      KeyConditionExpression: "creatorId = :creatorId",
      ExpressionAttributeValues: {
        ":creatorId": creatorId
      }
    });
    
    try {
      const response = await docClient.send(command);
      return (response.Items as FilmSeries[]) || [];
    } catch (e: any) {
      if (e.name === 'ValidationException' && e.message.includes('index')) {
        const series: FilmSeries[] = [];
        let exclusiveStartKey: Record<string, any> | undefined;
        do {
          const scanCommand = new ScanCommand({
            TableName: FILM_SERIES_TABLE,
            FilterExpression: "creatorId = :creatorId",
            ExpressionAttributeValues: {
              ":creatorId": creatorId
            },
            ExclusiveStartKey: exclusiveStartKey,
          });
          const scanResponse = await docClient.send(scanCommand);
          if (scanResponse.Items) {
            series.push(...(scanResponse.Items as FilmSeries[]));
          }
          exclusiveStartKey = scanResponse.LastEvaluatedKey;
        } while (exclusiveStartKey);
        return series;
      }
      throw e;
    }
  } catch (error) {
    console.error("Error getting series by creator:", error);
    throw error;
  }
}

export async function getSeriesEpisodes(seriesId: string): Promise<any[]> {
  try {
    const episodes: any[] = [];
    let exclusiveStartKey: Record<string, any> | undefined;

    do {
      const response = await docClient.send(
        new ScanCommand({
          TableName: "InPlayer-Videos",
          FilterExpression: "seriesId = :seriesId",
          ExpressionAttributeValues: {
            ":seriesId": seriesId,
          },
          ExclusiveStartKey: exclusiveStartKey,
        })
      );
      if (response.Items) {
        for (const item of response.Items) {
          const views = Number(item.views) || 0;
          const likes = Number(item.likes ?? item.likeCount) || 0;
          const currentThumbnailUrl =
            typeof item.thumbnailUrl === "string" ? item.thumbnailUrl : "";
          const hasCustomThumbnail =
            typeof item.customThumbnailUrl === "string" &&
            item.customThumbnailUrl.length > 0;
          const hasOldLandscapeMuxThumbnail =
            currentThumbnailUrl.startsWith("https://image.mux.com/") &&
            currentThumbnailUrl.includes("width=640&height=360");
          const portraitThumbnailUrl =
            !hasCustomThumbnail &&
            typeof item.muxPlaybackId === "string" &&
            item.muxPlaybackId &&
            (!currentThumbnailUrl || hasOldLandscapeMuxThumbnail)
              ? getMuxThumbnailUrl(item.muxPlaybackId, true)
              : null;
          episodes.push({
            ...item,
            ...(portraitThumbnailUrl && { thumbnailUrl: portraitThumbnailUrl }),
            views,
            likes,
            likeCount: likes,
          });
        }
      }
      exclusiveStartKey = response.LastEvaluatedKey;
    } while (exclusiveStartKey);
    
    return episodes.sort((a, b) => (Number(a.episodeNumber) || 0) - (Number(b.episodeNumber) || 0));
  } catch (error) {
    console.error("Error getting series episodes:", error);
    throw error;
  }
}

export async function createSeries(input: Omit<FilmSeries, 'seriesId' | 'episodeCount' | 'totalViews' | 'totalLikes' | 'subscriberCount' | 'createdAt' | 'updatedAt'>): Promise<FilmSeries> {
  try {
    const now = new Date().toISOString();
    const series: FilmSeries = {
      ...input,
      seriesId: randomUUID(),
      episodeCount: 0,
      totalViews: 0,
      totalLikes: 0,
      subscriberCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const command = new PutCommand({
      TableName: FILM_SERIES_TABLE,
      Item: series
    });
    
    await docClient.send(command);
    return series;
  } catch (error) {
    console.error("Error creating series:", error);
    throw error;
  }
}

export async function updateSeries(seriesId: string, creatorId: string, updates: Partial<FilmSeries>): Promise<void> {
  try {
    const existing = await getSeriesById(seriesId);
    if (!existing || existing.creatorId !== creatorId) {
      throw new Error("Series not found or unauthorized");
    }

    const updateKeys = Object.keys(updates).filter(k => k !== 'seriesId' && k !== 'creatorId');
    if (updateKeys.length === 0) return;

    const updateExpression = "SET " + updateKeys.map((k, i) => `#key${i} = :val${i}`).join(", ") + ", #updatedAt = :updatedAt";
    const expressionAttributeNames: Record<string, string> = { "#updatedAt": "updatedAt" };
    const expressionAttributeValues: Record<string, any> = { ":updatedAt": new Date().toISOString() };

    updateKeys.forEach((key, index) => {
      expressionAttributeNames[`#key${index}`] = key;
      expressionAttributeValues[`:val${index}`] = (updates as any)[key];
    });

    const command = new UpdateCommand({
      TableName: FILM_SERIES_TABLE,
      Key: { seriesId },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues
    });

    await docClient.send(command);
  } catch (error) {
    console.error("Error updating series:", error);
    throw error;
  }
}

export async function deleteSeries(seriesId: string, creatorId: string): Promise<void> {
  try {
    const existing = await getSeriesById(seriesId);
    if (!existing || existing.creatorId !== creatorId) {
      throw new Error("Series not found or unauthorized");
    }

    const command = new DeleteCommand({
      TableName: FILM_SERIES_TABLE,
      Key: { seriesId }
    });

    await docClient.send(command);
    
    const episodes = await getSeriesEpisodes(seriesId);
    for (const ep of episodes) {
      try {
        await docClient.send(new DeleteCommand({
          TableName: "InPlayer-Videos",
          Key: { videoId: ep.videoId }
        }));
      } catch (err) {
        console.error("Error deleting episode", ep.videoId, err);
      }
    }
  } catch (error) {
    console.error("Error deleting series:", error);
    throw error;
  }
}

export async function submitApplication(input: Omit<FilmCreatorApplication, 'applicationId' | 'status' | 'submittedAt'>): Promise<FilmCreatorApplication> {
  try {
    const application: FilmCreatorApplication = {
      ...input,
      applicationId: randomUUID(),
      status: "pending",
      submittedAt: new Date().toISOString()
    };

    const command = new PutCommand({
      TableName: FILM_APPLICATIONS_TABLE,
      Item: application
    });

    await docClient.send(command);
    return application;
  } catch (error) {
    console.error("Error submitting application:", error);
    throw error;
  }
}

export async function getApplicationByUserId(userId: string): Promise<FilmCreatorApplication | null> {
  try {
    const command = new QueryCommand({
      TableName: FILM_APPLICATIONS_TABLE,
      IndexName: "userId-index",
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: { ":userId": userId }
    });

    try {
      const response = await docClient.send(command);
      return (response.Items?.[0] as FilmCreatorApplication) || null;
    } catch (e: any) {
      if (e.name === 'ValidationException' && e.message.includes('index')) {
        const scanCommand = new ScanCommand({
          TableName: FILM_APPLICATIONS_TABLE,
          FilterExpression: "userId = :userId",
          ExpressionAttributeValues: { ":userId": userId }
        });
        const scanResponse = await docClient.send(scanCommand);
        return (scanResponse.Items?.[0] as FilmCreatorApplication) || null;
      }
      throw e;
    }
  } catch (error) {
    console.error("Error getting application by userId:", error);
    throw error;
  }
}

export async function getPendingApplications(): Promise<FilmCreatorApplication[]> {
  try {
    const command = new QueryCommand({
      TableName: FILM_APPLICATIONS_TABLE,
      IndexName: "status-index",
      KeyConditionExpression: "#status = :status",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":status": "pending" }
    });

    try {
      const response = await docClient.send(command);
      return (response.Items as FilmCreatorApplication[]) || [];
    } catch (e: any) {
      if (e.name === 'ValidationException' && e.message.includes('index')) {
        const scanCommand = new ScanCommand({
          TableName: FILM_APPLICATIONS_TABLE,
          FilterExpression: "#status = :status",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: { ":status": "pending" }
        });
        const scanResponse = await docClient.send(scanCommand);
        return (scanResponse.Items as FilmCreatorApplication[]) || [];
      }
      throw e;
    }
  } catch (error) {
    console.error("Error getting pending applications:", error);
    throw error;
  }
}

export async function reviewApplication(applicationId: string, action: "approve" | "reject", reviewedBy: string, rejectionReason?: string): Promise<void> {
  try {
    const getCommand = new GetCommand({
      TableName: FILM_APPLICATIONS_TABLE,
      Key: { applicationId }
    });
    const { Item } = await docClient.send(getCommand);
    const application = Item as FilmCreatorApplication | undefined;
    
    if (!application) throw new Error("Application not found");

    const status = action === "approve" ? "approved" : "rejected";
    const now = new Date().toISOString();

    const updateExpParts = ["#status = :status", "reviewedBy = :reviewedBy", "reviewedAt = :reviewedAt"];
    const expNames: Record<string, string> = { "#status": "status" };
    const expValues: Record<string, any> = {
      ":status": status,
      ":reviewedBy": reviewedBy,
      ":reviewedAt": now
    };

    if (action === "reject" && rejectionReason) {
      updateExpParts.push("rejectionReason = :rejectionReason");
      expValues[":rejectionReason"] = rejectionReason;
    }

    const updateCommand = new UpdateCommand({
      TableName: FILM_APPLICATIONS_TABLE,
      Key: { applicationId },
      UpdateExpression: "SET " + updateExpParts.join(", "),
      ExpressionAttributeNames: expNames,
      ExpressionAttributeValues: expValues
    });

    await docClient.send(updateCommand);

    if (action === "approve") {
      try {
        const userUpdateCommand = new UpdateCommand({
          TableName: "InPlayer-Users",
          Key: { userId: application.userId },
          UpdateExpression:
            "SET raftaarFilmsApproved = :approved, #n = if_not_exists(#n, :name), username = if_not_exists(username, :username), email = if_not_exists(email, :email), phoneNumber = if_not_exists(phoneNumber, :phone), channelName = if_not_exists(channelName, :channelName)",
          ExpressionAttributeNames: { "#n": "name" },
          ExpressionAttributeValues: {
            ":approved": true,
            ":name": application.personalName || application.channelName || "Creator",
            ":username": application.username || `creator_${application.userId.slice(0, 6)}`,
            ":email": application.email || "",
            ":phone": application.phoneNumber || "",
            ":channelName": application.channelName || "",
          },
        });
        await docClient.send(userUpdateCommand);
      } catch (userErr) {
        console.warn("Could not sync user profile in InPlayer-Users on approval:", userErr);
      }
    }
  } catch (error) {
    console.error("Error reviewing application:", error);
    throw error;
  }
}

export async function isApprovedFilmCreator(userId: string, email?: string): Promise<boolean> {
  try {
    if (email && isAdminEmail(email)) {
      return true;
    }

    const command = new GetCommand({
      TableName: "InPlayer-Users",
      Key: { userId },
      ProjectionExpression: "raftaarFilmsApproved, email"
    });
    
    const response = await docClient.send(command);
    if (response.Item?.raftaarFilmsApproved) {
      return true;
    }
    if (response.Item?.email && isAdminEmail(response.Item.email)) {
      return true;
    }

    // Fallback: check if user has an approved creator application
    const app = await getApplicationByUserId(userId);
    if (app && app.status === "approved") {
      try {
        await docClient.send(new UpdateCommand({
          TableName: "InPlayer-Users",
          Key: { userId },
          UpdateExpression: "SET raftaarFilmsApproved = :approved",
          ExpressionAttributeValues: { ":approved": true }
        }));
      } catch (e) {
        console.warn("Auto-heal raftaarFilmsApproved notice:", e);
      }
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error checking film creator approval:", error);
    return false;
  }
}


export async function subscribeToSeries(seriesId: string, userId: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    const command = new PutCommand({
      TableName: FILM_SERIES_SUBSCRIPTIONS_TABLE,
      Item: {
        seriesId,
        userId,
        createdAt: now
      }
    });

    await docClient.send(command);
    await incrementSeriesStats(seriesId, 'subscriberCount', 1);
  } catch (error) {
    console.error("Error subscribing to series:", error);
    throw error;
  }
}

export async function unsubscribeFromSeries(seriesId: string, userId: string): Promise<void> {
  try {
    const command = new DeleteCommand({
      TableName: FILM_SERIES_SUBSCRIPTIONS_TABLE,
      Key: {
        seriesId,
        userId
      }
    });

    await docClient.send(command);
    await incrementSeriesStats(seriesId, 'subscriberCount', -1);
  } catch (error) {
    console.error("Error unsubscribing from series:", error);
    throw error;
  }
}

export async function isSubscribedToSeries(seriesId: string, userId: string): Promise<boolean> {
  try {
    const command = new GetCommand({
      TableName: FILM_SERIES_SUBSCRIPTIONS_TABLE,
      Key: {
        seriesId,
        userId
      }
    });

    const response = await docClient.send(command);
    return !!response.Item;
  } catch (error) {
    console.error("Error checking subscription:", error);
    throw error;
  }
}

export async function incrementSeriesStats(
  seriesId: string,
  field: 'totalViews' | 'totalLikes' | 'episodeCount' | 'subscriberCount',
  delta: number = 1
): Promise<void> {
  try {
    const command = new UpdateCommand({
      TableName: FILM_SERIES_TABLE,
      Key: { seriesId },
      UpdateExpression: "SET #field = if_not_exists(#field, :zero) + :delta, updatedAt = :now",
      ExpressionAttributeNames: { "#field": field },
      ExpressionAttributeValues: {
        ":delta": delta,
        ":zero": 0,
        ":now": new Date().toISOString(),
      },
    });

    await docClient.send(command);
  } catch (error) {
    console.error(`Error incrementing series stat ${field}:`, error);
    try {
      const getRes = await docClient.send(
        new GetCommand({ TableName: FILM_SERIES_TABLE, Key: { seriesId } })
      );
      if (getRes.Item) {
        const curVal = Number(getRes.Item[field]) || 0;
        const newVal = Math.max(0, curVal + delta);
        await docClient.send(
          new UpdateCommand({
            TableName: FILM_SERIES_TABLE,
            Key: { seriesId },
            UpdateExpression: "SET #field = :val, updatedAt = :now",
            ExpressionAttributeNames: { "#field": field },
            ExpressionAttributeValues: {
              ":val": newVal,
              ":now": new Date().toISOString(),
            },
          })
        );
      }
    } catch (fallbackErr) {
      console.error(`Fallback update for series stat ${field} failed:`, fallbackErr);
    }
  }
}

export async function syncSeriesStats(
  seriesId: string
): Promise<{ totalViews: number; totalLikes: number; episodeCount: number }> {
  try {
    const episodes = await getSeriesEpisodes(seriesId);
    const episodeCount = episodes.length;
    const totalViews = episodes.reduce((sum, ep) => sum + (Number(ep.views) || 0), 0);
    const totalLikes = episodes.reduce(
      (sum, ep) => sum + (Number(ep.likeCount ?? ep.likes) || 0),
      0
    );

    await docClient.send(
      new UpdateCommand({
        TableName: FILM_SERIES_TABLE,
        Key: { seriesId },
        UpdateExpression:
          "SET episodeCount = :ec, totalViews = :tv, totalLikes = :tl, updatedAt = :now",
        ExpressionAttributeValues: {
          ":ec": episodeCount,
          ":tv": totalViews,
          ":tl": totalLikes,
          ":now": new Date().toISOString(),
        },
      })
    );

    return { totalViews, totalLikes, episodeCount };
  } catch (err) {
    console.error(`Failed to sync series stats for ${seriesId}:`, err);
    return { totalViews: 0, totalLikes: 0, episodeCount: 0 };
  }
}

export async function getTrendingSeries(limit: number = 10): Promise<FilmSeries[]> {
  try {
    const allSeries: FilmSeries[] = [];
    let exclusiveStartKey: Record<string, any> | undefined;

    do {
      const command = new ScanCommand({
        TableName: FILM_SERIES_TABLE,
        FilterExpression: "#status = :status",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":status": "published" },
        ExclusiveStartKey: exclusiveStartKey,
      });

      const response = await docClient.send(command);
      if (response.Items) {
        allSeries.push(...(response.Items as FilmSeries[]));
      }
      exclusiveStartKey = response.LastEvaluatedKey;
    } while (exclusiveStartKey);

    const score = (s: FilmSeries) =>
      (Number(s.totalViews) || 0) + (Number(s.totalLikes) || 0) * 2;

    return allSeries.sort((a, b) => score(b) - score(a)).slice(0, limit);
  } catch (error) {
    console.error("Error getting trending series:", error);
    throw error;
  }
}

export async function getFilmGenresWithCounts(): Promise<{genre: string; count: number}[]> {
  try {
    const command = new ScanCommand({
      TableName: FILM_SERIES_TABLE,
      FilterExpression: "#status = :status",
      ExpressionAttributeNames: { "#status": "status", "#genre": "genre" },
      ExpressionAttributeValues: { ":status": "published" },
      ProjectionExpression: "#genre"
    });

    const response = await docClient.send(command);
    const items = response.Items || [];
    
    const genreCounts: Record<string, number> = {};
    for (const item of items) {
      if (item.genre) {
        genreCounts[item.genre] = (genreCounts[item.genre] || 0) + 1;
      }
    }

    return Object.entries(genreCounts)
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count);
  } catch (error) {
    console.error("Error getting film genres with counts:", error);
    throw error;
  }
}
