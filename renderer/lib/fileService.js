
export const convertFile = async (event, setToken) => {
  /* Only support gif /png /jpg for viewing */
  const media = event?.target?.files[0]
  const base64Image= await convertToBase64(media);
  setToken(base64Image)
}

export const convertToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    fileReader.readAsDataURL(file);
    fileReader.onload = () => {
      resolve(fileReader.result);
    };
    fileReader.onerror = (error) => {
      reject(error);
    };
  });
};