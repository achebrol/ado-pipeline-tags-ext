/**
 * Wait for element to exist in DOM
 * @param {string} query - selector for target element(s).
 * @param {function} callback - callback function which receives the existing element(s).
 * @param {number} interval - ms between check for element(s) to exist.
 */
function waitForElements(
  query: string,
  callback: (builds: JQuery<HTMLElement>) => void,
  interval: number = 100
) {
  var elementsExist = setInterval(function () {
    let elements = $(query);
    if (elements.length) {
      callback(elements);
      clearInterval(elementsExist);
    }
  }, interval);
}

/**
 * Wait for element to exist in DOM
 * @param {string} query - selector for target element(s).
 * @param {function} callback - callback function which receives the existing element(s).
 * @param {number} interval - ms between check for element(s) to exist.
 */
function waitForChildElements(
  parent: JQuery<HTMLElement>,
  query: string,
  callback: (cols: JQuery<HTMLElement>) => void,
  interval: number = 100
) {
  var elementsExist = setInterval(function () {
    let elements = parent.find(query);
    if (elements.length) {
      callback(elements);
      clearInterval(elementsExist);
    }
  }, interval);
}

/**
 * Get a list of ADO build ids from <a> elements
 * @param {list} builds - list of <a> elements which represent builds.
 * @returns {list} list of build ids
 */
function extractBuildIds(builds: HTMLAnchorElement[]): string[] {
  return $.map(builds, function (val) {
    let url = val.href || '';
    let arr = url.split('buildId=');
    return arr.length > 1 ? arr[1] : '';
  });
}

/**
 * Create a new <span> element to represent a list of build tags
 * @param {list} tags - list of builds tags retrieved from ADO API.
 * @returns {Element} <span> element containing bolt pills to display tags.
 */
function createBuildTagsElement(tags: string[]) {
  let pillsContainer = $('<span class="ext-gen-tags flex-row flex-center">');
  tags.forEach((tag) => {
    let pillWrapper = $(
      '<div class="margin-right-4 bolt-pill flex-row flex-center standard compact" role="presentation" aria-label="' +
        tag +
        '">'
    );
    pillWrapper.append(
      $('<div class="bolt-pill-content text-ellipsis">' + tag + '</div>')
    );
    pillsContainer.append(pillWrapper);
  });
  bindTooltip(pillsContainer, tags);
  return pillsContainer;
}

/**
 * Create a new <bolt-popover> element to show all build tags
 * @returns {Element} <bolt-popover> element representing button+popover
 */
function createTooltipContainer(): JQuery<HTMLElement> {
  if ($('.tag-list-tooltip').length) {
    return;
  }
  let tooltip = $('<div class="tag-list-tooltip">');
  let container = $('.region-page');
  container.append(tooltip);
  return container;
}

function populateTooltip(tags: string[]) {
  let tooltip = $('.tag-list-tooltip');
  let tagList = $('<dl class="tag-dl">');
  tags.forEach((tag) => {
    let tagElement = $('<dt class="tooltip-tag">');
    tagElement.text(tag);
    tagList.append(tagElement);
  });
  tooltip.children().remove();
  tooltip.append(tagList);
}

function bindTooltip(element: JQuery<HTMLElement>, tags: string[]) {
  let tooltip = $('.tag-list-tooltip');
  element
    .on('mouseenter', () => {
      populateTooltip(tags);
      tooltip.css('visibility', 'visible');
    })
    .on('mouseleave', () => {
      tooltip.css('visibility', 'hidden');
    });
}

/**
 * Retrieve build details from ADO API, create bolt pills, and inject html into runs table
 * @async
 * @param {list} buildIds - list of build ids to query details from ADO API.
 * @param {string} token - ADO oauth token sourced from cookies
 */
async function addElements(buildIds: string[], token: string) {
  let baseUrl = window.location.toString().split('_build')[0];
  let query = buildIds.join(',');
  fetch(baseUrl + '_apis/build/builds?api-version=5.1&buildIds=' + query, {
    method: 'get',
    headers: {
      Authorization: 'Bearer ' + token,
    },
  })
    .then(function (response) {
      return response.json();
    })
    .then(function (json) {
      $.each(json.value, function (idx, build) {
        let buildRowQuery = `a[href$="buildId=${build.id}"]`;
        let buildTagColQuery =
          'td[data-column-index=1] > div.bolt-table-cell-content > div.flex-row';
        buildTagColQuery =
          'td:nth-child(3) > div.bolt-table-cell-content > div.stage-cell > div.flex-row';
        waitForElements(buildRowQuery, function (builds) {
          builds.first().addClass('table-cell-ext-gen-tags-mod');
          waitForChildElements(
            builds.first(),
            buildTagColQuery,
            function (cols) {
              let buildTagsCol = cols.first();

              let existingTooltip = buildTagsCol.children(
                '.ext-gen-tags-tooltip'
              );
              if (existingTooltip.length) {
                existingTooltip.remove();
              }
              let uniqueTags = new Set(build.tags as string[]);
              // buildTagsCol.append(createTagListTooltipElement(uniqueTags));

              let existingTags = buildTagsCol.children('.ext-gen-tags');
              if (existingTags.length) {
                existingTags.remove();
              }
              buildTagsCol.append(
                createBuildTagsElement(Array.from(uniqueTags))
              );
            }
          );
        });
      });
    });
}

/**
 * Bind functionality to add build tags to new builds inserted into the DOM
 */
function bindToNewBuilds() {
  waitForElements('table.runs-table', function (tbl) {
    tbl.on('DOMNodeInserted', function (e) {
      if (e.target.parentNode.nodeName == 'TBODY') {
        const buildIds = extractBuildIds([e.target as HTMLAnchorElement]);
        addElements(buildIds, '');
      }
    });
  });
}

chrome.storage.local.get(['ado_token'], function (result) {
  let rowQuery = 'table.runs-table > tbody > a[role=row]';
  console.log('hello world');
  // ADO Token exists in local storage
  if ('ado_token' in result) {
    waitForElements(rowQuery, function (rows) {
      addElements(
        extractBuildIds(rows.toArray().map((r) => r as HTMLAnchorElement)),
        result.ado_token
      );
      bindToNewBuilds();
    });

    createTooltipContainer();
  }
  // ADO token needs to be loaded from cookies
  else {
    chrome.runtime.sendMessage(
      { domain: 'https://dev.azure.com/*', name: 'UserAuthentication' },
      null,
      (cookie) => {
        //oauth_token = cookie.value;
        chrome.storage.local.set({ ado_token: cookie.value }, function () {
          addElements(
            extractBuildIds($<HTMLAnchorElement>(rowQuery).toArray()),
            cookie.value
          );
          bindToNewBuilds();
        });
      }
    );
  }
});
