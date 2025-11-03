"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectFoldRegions = exports.analyzeText = void 0;
const funcscript_1 = require("@tewelde/funcscript");
const parser_1 = require("@tewelde/funcscript/parser");
const COMMENT_TYPE = 'Comment';
const STRING_TYPES = new Set(['LiteralString', 'StringTemplate']);
const clampRange = (start, end, length) => {
    const safeStart = Math.max(0, Math.min(start, length));
    const safeEnd = Math.max(safeStart, Math.min(end, length));
    return safeEnd > safeStart ? { start: safeStart, end: safeEnd } : null;
};
const toSegment = (segment, docLength) => {
    const rawStart = typeof segment.Pos === 'number'
        ? segment.Pos
        : typeof segment.pos === 'number'
            ? segment.pos
            : null;
    const rawLength = typeof segment.Length === 'number'
        ? segment.Length
        : typeof segment.length === 'number'
            ? segment.length
            : null;
    const rawType = typeof segment.NodeType === 'string'
        ? segment.NodeType
        : typeof segment.nodeType === 'string'
            ? segment.nodeType
            : null;
    if (rawStart === null || rawLength === null || rawLength <= 0 || !rawType) {
        return null;
    }
    const range = clampRange(rawStart, rawStart + rawLength, docLength);
    if (!range) {
        return null;
    }
    return {
        start: range.start,
        end: range.end,
        nodeType: rawType
    };
};
const collectCommentSegments = (text) => {
    const segments = [];
    const length = text.length;
    let index = 0;
    let inString = null;
    while (index < length) {
        const ch = text[index];
        if (inString) {
            if (ch === '\\' && index + 1 < length) {
                index += 2;
                continue;
            }
            if (ch === inString) {
                inString = null;
            }
            index += 1;
            continue;
        }
        if (ch === '\'' || ch === '"') {
            inString = ch;
            index += 1;
            continue;
        }
        if (ch === '/' && index + 1 < length && text[index + 1] === '/') {
            let end = index + 2;
            while (end < length) {
                const endChar = text[end];
                if (endChar === '\n' || endChar === '\r') {
                    break;
                }
                end += 1;
            }
            segments.push({ start: index, end, nodeType: COMMENT_TYPE });
            index = end;
            continue;
        }
        index += 1;
    }
    return segments;
};
const sanitizeForParser = (text, commentSegments) => {
    if (!commentSegments.length) {
        return text;
    }
    const chars = Array.from(text);
    for (const segment of commentSegments) {
        for (let index = segment.start; index < segment.end && index < chars.length; index += 1) {
            if (chars[index] === '\n') {
                continue;
            }
            chars[index] = ' ';
        }
    }
    return chars.join('');
};
const filterCommentSegments = (commentSegments, baseSegments) => {
    if (!commentSegments.length || !baseSegments.length) {
        return commentSegments;
    }
    const stringRanges = baseSegments
        .filter((segment) => STRING_TYPES.has(segment.nodeType))
        .map((segment) => ({ start: segment.start, end: segment.end }))
        .sort((a, b) => a.start - b.start);
    if (!stringRanges.length) {
        return commentSegments;
    }
    return commentSegments.filter((segment) => {
        const index = segment.start;
        let left = 0;
        let right = stringRanges.length - 1;
        while (left <= right) {
            const mid = (left + right) >> 1;
            const range = stringRanges[mid];
            if (index < range.start) {
                right = mid - 1;
            }
            else if (index >= range.end) {
                left = mid + 1;
            }
            else {
                return false;
            }
        }
        return true;
    });
};
const subtractSegments = (baseSegments, removals) => {
    if (!removals.length) {
        return baseSegments;
    }
    const sortedRemovals = [...removals].sort((a, b) => a.start - b.start || a.end - b.end);
    const result = [];
    for (const base of baseSegments) {
        let pending = [{ start: base.start, end: base.end }];
        for (const removal of sortedRemovals) {
            const nextPending = [];
            for (const segment of pending) {
                if (removal.end <= segment.start || removal.start >= segment.end) {
                    nextPending.push(segment);
                    continue;
                }
                if (removal.start > segment.start) {
                    nextPending.push({ start: segment.start, end: Math.max(segment.start, removal.start) });
                }
                if (removal.end < segment.end) {
                    nextPending.push({ start: Math.min(segment.end, removal.end), end: segment.end });
                }
            }
            pending = nextPending;
            if (!pending.length) {
                break;
            }
        }
        for (const segment of pending) {
            if (segment.end > segment.start) {
                result.push({ ...base, start: segment.start, end: segment.end });
            }
        }
    }
    return result;
};
const findFirstCodeIndex = (text) => {
    for (let index = 0; index < text.length; index += 1) {
        const ch = text[index];
        if (ch !== ' ' && ch !== '\t' && ch !== '\r' && ch !== '\n') {
            return index;
        }
    }
    return text.length;
};
const shiftParseTree = (root, offset) => {
    if (!root || offset === 0) {
        return;
    }
    const stack = [root];
    while (stack.length) {
        const current = stack.pop();
        if (!current) {
            continue;
        }
        const raw = current;
        if (typeof raw.Pos === 'number') {
            raw.Pos += offset;
        }
        const childNodes = (current.Childs ?? []);
        for (const child of childNodes) {
            stack.push(child);
        }
    }
};
const analyzeText = (text) => {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
        return {
            parseNode: null,
            segments: [],
            text
        };
    }
    const commentSegments = collectCommentSegments(text);
    const sanitized = sanitizeForParser(text, commentSegments);
    const leadingOffset = findFirstCodeIndex(sanitized);
    const parserInput = leadingOffset > 0 ? sanitized.slice(leadingOffset) : sanitized;
    if (parserInput.trim().length === 0) {
        return {
            parseNode: null,
            segments: commentSegments,
            text
        };
    }
    try {
        const provider = new funcscript_1.DefaultFsDataProvider();
        const { parseNode } = parser_1.FuncScriptParser.parse(provider, parserInput);
        if (!parseNode) {
            return {
                parseNode: null,
                segments: commentSegments,
                text
            };
        }
        shiftParseTree(parseNode, leadingOffset);
        const rawSegments = (0, funcscript_1.colorParseTree)(parseNode);
        const baseSegments = rawSegments
            .map((segment) => toSegment(segment, text.length))
            .filter((segment) => Boolean(segment));
        const filteredComments = filterCommentSegments(commentSegments, baseSegments);
        const trimmedBase = subtractSegments(baseSegments, filteredComments);
        const merged = trimmedBase.concat(filteredComments);
        const segments = merged
            .sort((a, b) => (a.start === b.start ? a.end - b.end : a.start - b.start));
        return {
            parseNode,
            segments,
            text
        };
    }
    catch (error) {
        return {
            parseNode: null,
            segments: commentSegments,
            text
        };
    }
};
exports.analyzeText = analyzeText;
const getChildNodes = (node) => {
    const value = node.Childs ?? node.childs ?? node.Children ?? node.children;
    return Array.isArray(value) ? value : [];
};
const toNodeRange = (node, docLength) => {
    const raw = node;
    if (typeof raw.Pos !== 'number' || typeof raw.Length !== 'number' || raw.Length <= 0) {
        return null;
    }
    return clampRange(raw.Pos, raw.Pos + raw.Length, docLength);
};
const collectFoldRegions = (root, docLength) => {
    if (!root || docLength <= 0) {
        return [];
    }
    const stack = [root];
    const result = [];
    while (stack.length) {
        const current = stack.pop();
        if (!current) {
            continue;
        }
        const range = toNodeRange(current, docLength);
        if (range) {
            result.push(range);
        }
        for (const child of getChildNodes(current)) {
            stack.push(child);
        }
    }
    return result.sort((a, b) => a.start - b.start);
};
exports.collectFoldRegions = collectFoldRegions;
//# sourceMappingURL=analysis.js.map