const path = require("node:path");
const config = require("./config");

const IMAGE_EXTENSIONS = new Set([
  ".avif",
  ".bmp",
  ".gif",
  ".heic",
  ".heif",
  ".jpeg",
  ".jpg",
  ".png",
  ".tif",
  ".tiff",
  ".webp",
]);

function isImageAttachment(attachment) {
  if (attachment.contentType?.toLowerCase().startsWith("image/")) return true;
  return IMAGE_EXTENSIONS.has(path.extname(attachment.name || "").toLowerCase());
}

function isQualifyingImageMessage(message) {
  if (message.content.trim() !== "") return false;
  const attachments = Array.from(message.attachments.values());
  const imageCount = attachments.filter(isImageAttachment).length;
  return imageCount >= config.MIN_IMAGES_PER_MESSAGE;
}

module.exports = { isImageAttachment, isQualifyingImageMessage };
