Step 6: Periodically Update the Backend Code
When you update your backend repository and want to pull those changes into the /backend folder of the frontend repository, use the git subtree pull command:
bash

git fetch backend-upstream
git subtree pull --prefix=backend backend-upstream main --squash

git fetch backend-upstream: Updates the local copy of the backend repository’s data.

--prefix=backend: Specifies the subdirectory to update.

backend-upstream main: The remote and branch to pull from.

--squash: Again, squashes the backend changes into a single commit (optional).

Then push the updated frontend repository:
bash

git push origin main

test