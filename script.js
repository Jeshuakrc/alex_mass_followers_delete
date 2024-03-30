console.log("::twu init::");
const html = document.querySelector("html");
let timerHandle;
let previousScrollHeight = 0;
let inProgress;
const deleteedFollowers = [];
let shared = {}; // shared.js module
(async () => {
  const sharedSrc = chrome.runtime.getURL("shared.js");
  shared = await import(sharedSrc);
})();

const tmuWrapper = document.createElement("div");
tmuWrapper.style.cssText = `
  position: fixed;
  right: 20px;
  bottom: 70px;
  z-index: 10;
  display: flex;
  visibility: hidden;`.trim();

let totalUnFollowed = document.createElement("h1");
totalUnFollowed.textContent = -1230;
totalUnFollowed.style.cssText = `
  background: #1da1f2;
  color: #fff;
  font-weight: bold;
  border-radius: 50%;
  margin-right: 10px;
  font-size: 16px;
  width: 50px;
  height: 50px;
  padding: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  align-self: flex-end;
`;

let img = document.createElement("img");
img.style.width = "80px";
img.alt = "running";
img.src =
  "https://github.com/codeshifu/assets/blob/main/gifs/eevee.gif?raw=true";

tmuWrapper.appendChild(totalUnFollowed);
tmuWrapper.appendChild(img);

document.body.appendChild(tmuWrapper);

const showContentInDOM = () => {
  tmuWrapper.style.visibility = "visible";
};

const getFollowingsContainer = () => {
  return document.querySelector("section[role=region] div");
};

const getFollowers = () => {
  const followers = [];
  const domFollowers = Array.from(
    document.querySelectorAll(
      'section[role=region] [data-testid="UserCell"]'
    )
  );
  
  for (let follower of domFollowers) {
    const buttons = follower.querySelectorAll("[role=button]");
    let name = [...buttons.values()]
          .map(b => b.getAttribute("aria-label"))
          .filter(a => a)
          .filter(a => /(.*)@(.*)/.test(a));
    if (name.length < 1) { continue; }
    name = name[0].replace(/.*@/, "");

    let moreOptions = [...buttons.values()]
          .filter(b => {
            const a = b.getAttribute("aria-label");
            if (!a) { return true; }
            return !(/(.*)@(.*)/.test(a));
          });
    if (moreOptions.length < 1) { continue; }
    moreOptions = moreOptions[0];

    followers.push({
      name: name,
      optionsButton: moreOptions
    });
  }
  return followers;
}

const filterFollowings = async (followers) => {
  const whitelistedUsers = await shared.storage.get(shared.whiteListedUsersKey);

  const toUnfollow = followers.filter((follower) => {
    if (!whitelistedUsers) return true;
    const username = follower.name;
    return !whitelistedUsers.includes(username);
  });

  return toUnfollow;
};

const findDeleteButton = () =>
  document.querySelector('div[role=menu] [data-testid=removeFollower]');

const findConfirmDeleteButton = () => 
  document.querySelector("[data-testid=confirmationSheetDialog] div[data-testid=confirmationSheetConfirm]");

const findCancelDeleteButton = () => 
  document.querySelector("[data-testid=confirmationSheetDialog] div[data-testid=confirmationSheetCancel]");

const unfollow = async (followers = [], demo) => {
  for (const follower of followers) {
    console.log(follower);

    const { name, optionsButton } = follower;
    const username = name;
    if (deleteedFollowers.includes(username)) { continue; }

    deleteedFollowers.push(username);
    totalUnFollowed.textContent = `-${deleteedFollowers.length}`;

    optionsButton.click();
    await shared.delay(500);
    findDeleteButton().click();
    await shared.delay(500);
    
    const finishButton = demo ? findCancelDeleteButton() : findConfirmDeleteButton();
    finishButton.click();
    await shared.delay(500);
  }
};

const scrollFollowingList = async ({ unfollowNotFollowing, demo } = {}) => {
  if (
    previousScrollHeight !== html.scrollHeight &&
    inProgress &&
    shared.isExtensionPage()
  ) {
    previousScrollHeight = html.scrollHeight;

    const followingsContainer = getFollowingsContainer();
    const scrollBy = followingsContainer.clientHeight;

    const followings = getFollowers();
    const accountsToUnfollow = await filterFollowings(
      followings,
      unfollowNotFollowing
    );

    await unfollow(accountsToUnfollow, demo);

    html.scroll({
      top: followingsContainer.offsetHeight + scrollBy,
      behavior: "smooth",
    });

    await shared.delay(3000);
    scrollFollowingList({ unfollowNotFollowing, demo });
  }
};

const stopUnfollowing = async () => {
  if (!inProgress) return;

  inProgress = false;
  if (timerHandle) clearInterval(timerHandle);

  const shouldReload = await shared.storage.get(shared.reloadOnStoppedKey);
  img.src =
    "https://github.com/codeshifu/assets/blob/main/gifs/mario_wave.gif?raw=true";
  await shared.delay(2000);
  if (shouldReload) window.location.reload();
  tmuWrapper.style.visibility = "hidden";
  img.src =
    "https://github.com/codeshifu/assets/blob/main/gifs/eevee.gif?raw=true";
};

const startTimer = () => {
  shared.storage.get(shared.timerKey).then((autoStop) => {
    if (autoStop) {
      timerHandle = setTimeout(() => stopUnfollowing(), 1000 * 60); // 60secs
    }
  });
};

const run = ({ unfollowNotFollowing, demo } = {}) => {
  if (inProgress) return;

  inProgress = true;
  showContentInDOM();
  scrollFollowingList({ unfollowNotFollowing, demo });
  startTimer();
};

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  try {
    switch (message.type) {
      case shared.UNFOLLOW_ALL:
        run();
        return;
      case shared.UNFOLLOW_NOT_FOLLOWING:
        run({ unfollowNotFollowing: true });
        return;
      case shared.DEMO:
        run({ demo: true });
        return;
      case shared.STOP:
        stopUnfollowing();
        return;
      case shared.CHECK_IN_PROGRESS:
        reply({ payload: previousScrollHeight !== 0 && inProgress });
        return;
      default:
        break;
    }
  } catch (error) {
    console.log(error);
  }
});

window.addEventListener("beforeunload", () => stopUnfollowing());

document.body.addEventListener("click", () => {
  if (!shared.isExtensionPage() && inProgress) stopUnfollowing();
});
